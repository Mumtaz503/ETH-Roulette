# ETH-Roulette

Is a fully decentralized, provably and verifiably random game of Casino roulette built on EVM. This project is a use-case for the implementation of Chainlink's VRF and Automation contracts focusing primarily on the gaming industry. This project of course has some limitations which will be adressed in the following sections.

## Note

The project is purely for educational purposes and I DO NOT support gambling in any way, shape or form.

## Technical details

The base contract `Roulette.sol` imports its core functionality from `VRFCoordinatorV2Interface`, `VRFConsumerBaseV2` and `AutomationCompatibleInterface`. After obtaining the required addresses and variables from the constructor, the contract asks users to enter the game by calling the `enterRoulette` payable function. Here the function performs relevant checks and updates the player's and the game's data.

The players are then allowed to place their bets by passing the data as a struct to the `placeBet` function. There are various checks in place to ensure the security of the game as this is a core game payable function.

 **The important note here is that a player can place one bet at a time. So this is the first limitation of the protocol**

The `checkUpkeep` function is monitors the `BetState` enum and once the required conditions meet for triggering a response, it calls the `performUpkeep` function. In this case the `checkUpkeep` function looks the current `BetState`, current time to allow players enough time to place their bets, the `bets` and the balance of the contract to trigger a functionality in `performUpkeep`.

Once the reuired conditions are met then the `checkUpkeep` functions returns true and triggers `performUpkeep` that makes a call to the Chainlink's VRF Coordinator to generate a random number to select a random element from the table.

**You need some test LINK tokens in your wallet to set this up on Chainlink's protocols**

Here are some learning resources:

* [Chainlink VRF](https://docs.chain.link/vrf)
* [Chainlink Automation](https://docs.chain.link/chainlink-automation)
* [Get some test LINK tokens](https://faucets.chain.link/)

These guides explain how you can set up the VRF Coordinator and Automation with your own protocol.

**The second limitation here is that you have to constantly update your Chainlink account with LINK tokens as users interact with your protocol**

There may be a way to automate this, however, I have not looked into it. But if you find a way to automate the process feel free to fork the repo and use it and do let me know. :)

The `performUpkeep` function is set to trigger a response to the VRF Coordinator whenever the `checkUpkeep` returns true. Once the conditions are met the `performUpkeep` makes a call to the `requestRandomWords` function on the Corrdinator that returns are `requestId`.

This request id is basically the id of the request made to the VRF Coordinator to return the request amount of `randomWords` (random numbers). I didn't use this `requestId` in my protocol, however, if you need you can store it in a `uint256` array.

The VRF Coordinator then does its job and fulfills the request to the `fulfillRandomWords` function that takes an array of `randomWords` as a parameter. These are the requested random numbers returned by the VRF Coordinator. In my case I'm only calling for "one" random number.

The `fulfillRandomWords` function then uses the random number to select a `s_table` element and checks if the element exists in one of the bets. It then updates the required variables and states.

**Another limitation is that the Chainlink's coordinator only returns 500 `randomWords` per request and calling the functions back and forth can be very expensive in terms of gas**

Lastly there are "payout" handling functions that allows the players and the contract owner to withdraw their funds from the contracts.

The `calculatePayout` function calculates the amount of payout a player recieves as per the rules of a game of Casino Roulette.


## Important 

⚠️ The following contract(s) are unauditied. Please be carefull before deploying them on mainnet. ⚠️ 
