const { ethers, getNamedAccounts, network } = require("hardhat");

async function placeBet() {
    const roulette = await ethers.getContract("Roulette");
    const entranceFee = await roulette.getEntranceFee();
    await roulette.enterRoulette({ value: entranceFee + 1 });
    console.log("Successfully Entered the game");

    const betAmountPlaced = ethers.utils.parseEther("0.030");
    const bet = {
        betElements: ["13B", "14R", "15B", "16R", "17B", "18R", "19R", "20B", "21R", "22B", "23R", "24B"],
        betAmount: betAmountPlaced,
        isInsideBet: false,
    }

    const tx = await roulette.placeBet(bet, { value: betAmountPlaced });
    tx.wait(1);
    const placedBets = await roulette.getBets();
    console.log(`Bet Placed: ${placedBets}`);
    console.log(`Okay now we wait for the response from Chainlink Automation`);

    const wonBets = await roulette.getWonBets();

    if (wonBets.length > 0) {
        console.log(`You Won ${wonBets}`);
        await roulette.handlePayout();
        console.log("Payout handled");
    } else {
        console.log("You lost the bets");
    }
}

placeBet()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    });