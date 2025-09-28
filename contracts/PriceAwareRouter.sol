// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * PriceAwareRouter + uniswapAMM
 *
 * - MockAMM: minimal constant-product pool (no fees) for swap testing.
 * - Router: reads Chainlink (aggregator) and AMM pool price, compares deviation, reverts if > threshold.
 * - Decimal normalization: all price comparisons use 18-decimal normalized values.
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address a) external view returns (uint256);
    function transfer(address to, uint256 amt) external returns (bool);
    function approve(address spender, uint256 amt) external returns (bool);
    function transferFrom(address from, address to, uint256 amt) external returns (bool);
    function decimals() external view returns (uint8);
}

interface AggregatorV3Interface {
  function latestRoundData() external view returns (
    uint80 roundId,
    int256 answer,
    uint256 startedAt,
    uint256 updatedAt,
    uint80 answeredInRound
  );
  function decimals() external view returns (uint8);
}

interface ICCIPRouter {
    function sendMessage(address receiver, bytes calldata data) external payable returns (bytes32);
}


/**
 * Minimal MockAMM: constant product pool for tokenA/tokenB with simplified swap semantics.
 * - constructor sets tokenA and tokenB addresses and initial reserves must be minted/transferred externally.
 * - getReserves(): returns current reserveA, reserveB and their decimals.
 * - getPoolPriceNormalized(): returns price of tokenA in terms of tokenB normalized to 1e18 (i.e., price = reserveB / reserveA * 1e18)
 * - swap(amountIn, tokenIn, to): returns amountOut and transfers tokenOut to `to`.
 *
 * Note: No fees, no oracle. Purely for on-chain pool price simulation and swap execution.
 */
contract MockAMM {
    address public tokenA;
    address public tokenB;

    constructor(address _tokenA, address _tokenB) {
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    // get reserves (read token balances)
    function getReserves() public view returns (uint256 reserveA, uint256 reserveB) {
        reserveA = IERC20(tokenA).balanceOf(address(this));
        reserveB = IERC20(tokenB).balanceOf(address(this));
    }

    // compute pool price = reserveB / reserveA normalized to 18 decimals
    function getPoolPriceNormalized() public view returns (uint256 price18) {
        (uint256 rA, uint256 rB) = getReserves();
        require(rA > 0 && rB > 0, "empty reserves");
        uint8 decA = IERC20(tokenA).decimals();
        uint8 decB = IERC20(tokenB).decimals();

        // Normalize reserves to 18 decimals for price calc
        uint256 rA18 = _scaleTo18(rA, decA);
        uint256 rB18 = _scaleTo18(rB, decB);

        // price = rB18 * 1e18 / rA18  (so price has 18 decimals)
        price18 = (rB18 * 1e18) / rA18;
    }

    // swap: tokenIn must be already transferred to this contract prior or transferred as part of this call
    // We'll implement swap that pulls tokenIn via transferFrom from msg.sender (router will be msg.sender)
    // and sends tokenOut to 'to'
    function swap(address tokenIn, uint256 amountIn, address to) external returns (uint256 amountOut) {
        require(amountIn > 0, "zero in");
        // identify direction
        address tokenOut;
        if (tokenIn == tokenA) {
            tokenOut = tokenB;
        } else if (tokenIn == tokenB) {
            tokenOut = tokenA;
        } else {
            revert("invalid token");
        }

        // fetch reserves BEFORE transfer (we'll increase reserveIn by amountIn in calculation)
        (uint256 rA, uint256 rB) = getReserves();

        // Transfer tokenIn from msg.sender to this AMM
        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "amm transferFrom failed");

        // Update reserves after deposit
        if (tokenIn == tokenA) {
            rA += amountIn;
        } else {
            rB += amountIn;
        }

        // Constant product: amountOut = rOut - (k / (rIn))
        // k = rA_before * rB_before (note: using balances before transfer would be more canonical, but we've transferred)
        // For simplicity and safety use: amountOut = (amountIn * rOut) / (rIn + amountIn)
        // This yields an output proportional to amountIn relative to reserves (no fee)
        uint256 rIn = (tokenIn == tokenA) ? rA : rB;
        uint256 rOut = (tokenIn == tokenA) ? rB : rA;

        // amountOut = (amountIn * rOut) / (rIn)  — but this may be too aggressive; use CP approx:
        // amountOut = (amountIn * rOut) / (rIn)  (simple)
        amountOut = (amountIn * rOut) / rIn;

        require(amountOut > 0, "zero out");

        // Transfer tokenOut to recipient
        require(IERC20(tokenOut).transfer(to, amountOut), "amm transfer out failed");

        return amountOut;
    }

    function _scaleTo18(uint256 amount, uint8 decimalsToken) internal pure returns (uint256) {
        if (decimalsToken == 18) return amount;
        if (decimalsToken < 18) {
            return amount * (10 ** (18 - decimalsToken));
        } else {
            return amount / (10 ** (decimalsToken - 18));
        }
    }
}

/**
 * PriceAwareRouter expanded
 *
 * - Holds aggregator mapping
 * - Has `maxAllowedDeviationBps` guard (in basis points, so 100 bps = 1%)
 * - Interacts with MockAMM: before executing swap, reads pool price and compares to oracle price
 * - If deviation > threshold => revert
 *
 * Swap flow used for tests:
 * 1) user approves router for tokenIn
 * 2) router checks oracle freshness and pool deviation
 * 3) router calls amm.swap(tokenIn, amountIn, to) but transferFrom currently pulls funds from router by AMM, so router must approve AMM or call transferFrom on user's behalf
 *
 * For simplicity: router will call amm.swap(tokenIn, amountIn, to) which expects router to be the caller;
 * AMM.swap will call transferFrom(msg.sender, ammpool) so router must have allowance from user.
 */
contract PriceAwareRouter {
    address public owner;
    uint256 public maxOracleAge = 5 minutes;
    uint256 public maxAllowedDeviationBps = 500; // 5% default
    address public ccipRouter;

    mapping(address => address) public aggregators; // token -> aggregator
    mapping(address => address) public ammForPair;  // pairKey -> amm address (we use tokenA as key; store amm address for tokenA/tokenB pairs)

    bool private _entered;

    event SwapExecuted(address indexed sender, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    event DeviationTooLarge(uint256 poolPrice18, uint256 oraclePrice18, uint256 deviationBps);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }
    modifier nonReentrant() {
        require(!_entered, "reentrant");
        _entered = true;
        _;
        _entered = false;
    }
    modifier onlyCCIPRouter() {
        require(msg.sender == ccipRouter, "only ccip router");
        _;
    }

    constructor(address _ccipRouter) {
        owner = msg.sender;
        ccipRouter = _ccipRouter;
    }

    // Admin / config
    function setAggregator(address token, address aggregator) external onlyOwner {
        aggregators[token] = aggregator;
    }
    function setAMMForPair(address tokenA, address amm) external onlyOwner {
        ammForPair[tokenA] = amm;
    }
    function setMaxAllowedDeviationBps(uint256 bps) external onlyOwner {
        require(bps <= 5000, "max 50%");
        maxAllowedDeviationBps = bps;
    }

    // Get normalized oracle price for a single token (price relative to USD or stable unit).
    function _getLatestPriceNormalized(address token) internal view returns (uint256 price18, uint256 updatedAt) {
        address agg = aggregators[token];
        require(agg != address(0), "no aggregator for token");
        (, int256 answer, , uint256 updated, ) = AggregatorV3Interface(agg).latestRoundData();
        require(answer > 0, "invalid oracle answer");
        uint8 dec = AggregatorV3Interface(agg).decimals();

        if (dec <= 18) {
            price18 = uint256(answer) * (10 ** (18 - dec));
        } else {
            price18 = uint256(answer) / (10 ** (dec - 18));
        }
        updatedAt = updated;
    }

    // Utility to compute 18-dec normalized price of tokenIn expressed in tokenOut: priceIn/priceOut (both normalized 18)
    function _getPairOraclePriceNormalized(address tokenIn, address tokenOut) internal view returns (uint256 price18) {
        (uint256 pIn, uint256 tIn) = _getLatestPriceNormalized(tokenIn);
        (uint256 pOut, uint256 tOut) = _getLatestPriceNormalized(tokenOut);
        require(block.timestamp - tIn <= maxOracleAge, "stale price in");
        require(block.timestamp - tOut <= maxOracleAge, "stale price out");

        // price(tokenIn in terms of tokenOut) = pIn / pOut ; both pIn & pOut are 1e18 scaled
        price18 = (pIn * 1e18) / pOut; // result still 1e18 scale
    }

    // Compute pool price for pair using the configured AMM (AMM must support getPoolPriceNormalized)
    function _getPoolPriceNormalizedFromAMM(address amm, address /*tokenA*/, address /*tokenB*/) internal view returns (uint256 poolPrice18) {
        require(amm != address(0), "no amm");
        // We rely on MockAMM having getPoolPriceNormalized for tokenA/tokenB ordering
        // The MockAMM implemented here is designed for tokenA/tokenB order: if tokenA param is correct it returns reserveB/reserveA
        poolPrice18 = MockAMM(amm).getPoolPriceNormalized();
    }

    // Deviation check: (abs(pool - oracle) * 10000) / oracle <= maxAllowedDeviationBps
    function _checkDeviation(uint256 poolPrice18, uint256 oraclePrice18) internal view returns (bool ok, uint256 deviationBps) {
        if (oraclePrice18 == 0) return (false, type(uint256).max);
        uint256 diff = poolPrice18 > oraclePrice18 ? poolPrice18 - oraclePrice18 : oraclePrice18 - poolPrice18;
        // compute bps carefully: (diff * 10000) / oraclePrice18
        deviationBps = (diff * 10000) / oraclePrice18;
        ok = deviationBps <= maxAllowedDeviationBps;
    }

    // main swap entrypoint: single-hop via AMM
    function swapExactTokensForTokensViaAMM(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "deadline");
        require(amountIn > 0, "zero amount");

        // locate AMM for pair (we keyed by tokenIn for simplicity)
        address amm = ammForPair[tokenIn];
        require(amm != address(0), "no amm for pair");

        // 1) compute oracle pair price (tokenIn denominated in tokenOut)
        uint256 oraclePairPrice18 = _getPairOraclePriceNormalized(tokenIn, tokenOut);

        // 2) compute pool price from AMM (we assume AMM.getPoolPriceNormalized returns tokenIn->tokenOut price)
        uint256 poolPrice18 = _getPoolPriceNormalizedFromAMM(amm, tokenIn, tokenOut);

        // 3) deviation check
        (bool ok, uint256 deviationBps) = _checkDeviation(poolPrice18, oraclePairPrice18);
        if (!ok) {
            emit DeviationTooLarge(poolPrice18, oraclePairPrice18, deviationBps);
            revert("pool price deviates");
        }

        // 4) execute swap on AMM - AMM.swap expects to pull tokenIn via transferFrom(msg.sender) where msg.sender == router
        // so the user must approve router, and router must itself have allowance for AMM to pull from router,
        // To keep call flow simple: user approves router; router will call IERC20.transferFrom(user, amm, amountIn) first,
        // then call amm.swap with amountIn and to.
        // We'll implement that approach: transfer tokenIn from user to AMM first.
        require(IERC20(tokenIn).transferFrom(msg.sender, amm, amountIn), "transfer to amm failed");

        // call amm.swap which will compute amountOut and send tokenOut to 'to'
        amountOut = MockAMM(amm).swap(tokenIn, amountIn, to);

        require(amountOut >= amountOutMin, "insufficient output");

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    // ccip stub & callback kept for compatibility with earlier code
    function routeCrossChain(
        uint256 /*destinationChainId*/,
        address receiver,
        address token,
        uint256 amount,
        bytes calldata extra
    ) external payable nonReentrant returns (bytes32 messageId) {
        require(ccipRouter != address(0), "no ccip router");
        require(amount > 0, "zero amount");

        // Transfer token from sender to this contract for custody
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "token transfer failed");

        bytes memory payload = abi.encode(token, amount, receiver, extra);

        messageId = ICCIPRouter(ccipRouter).sendMessage(receiver, payload);
    }

    function ccipReceive(address /*sender*/, bytes calldata payload) external onlyCCIPRouter nonReentrant {
        (address token, uint256 amount, address to,) = abi.decode(payload, (address, uint256, address, bytes));
        require(IERC20(token).transfer(to, amount), "settle failed");
    }

    // Helpers
    function _scaleTo18(uint256 amount, uint8 decimalsToken) internal pure returns (uint256) {
        if (decimalsToken == 18) return amount;
        if (decimalsToken < 18) {
            return amount * (10 ** (18 - decimalsToken));
        } else {
            return amount / (10 ** (decimalsToken - 18));
        }
    }
}

/*
 * NOTE:
 * - This implementation chooses a simple flow: router transfers tokenIn from user to AMM, then calls AMM.swap(tokenIn, amountIn, to).
 * - Alternative design would be router depositing into AMM then instructing AMM to swap; both are fine for demo.
 * - AMM.swap uses a simplified CP-like calculation and sends tokenOut to 'to'.
 */
