const { ethers, network } = require("hardhat");
const fs = require("fs");

const FRONTEND_ADDRESSES_FILE = "../next-app-roulette/constants/contractAddresses.json";
const FRONTEND_ABI_FILE = "../next-app-roulette/constants/abi.json";

module.exports = async function () {
    if (process.env.UPDATE_FRONTEND) {
        console.log("Updating Files for Front-end")
        updateContractAddresses();
        updateAbi();
    }
}

async function updateContractAddresses() {
    const roulette = await ethers.getContract("Roulette");
    const chainId = network.config.chainId.toString();
    const currentAddresses = JSON.parse(fs.readFileSync(FRONTEND_ADDRESSES_FILE, "utf8"));
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(roulette.address)) {
            currentAddresses[chainId].push(roulette.address);
        }
    }
    {
        currentAddresses[chainId] = [roulette.address];
    }
    fs.writeFileSync(FRONTEND_ADDRESSES_FILE, JSON.stringify(currentAddresses));
}

async function updateAbi() {
    const roulette = await ethers.getContract("Roulette");
    fs.writeFileSync(FRONTEND_ABI_FILE, roulette.interface.format(ethers.utils.FormatTypes.json));
}

module.exports.tags = ["frontend"];