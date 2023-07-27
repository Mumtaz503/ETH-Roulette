const { ethers } = require("hardhat");

async function enterRoulette() {
    const roulette = await ethers.getContract("Roulette");
    const entranceFee = await roulette.getEntranceFee();
    await roulette.enterRoulette({ value: entranceFee + 1 });
    console.log("Successfully Entered the game ");
}

enterRoulette()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    });