async function mockAutomation() {
    const roulette = await ethers.getContract("Roulette");
    const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""));
    const { upkeepNeeded } = await roulette.callStatic.checkUpkeep(checkData);
    if (upkeepNeeded) {
        const tx = await roulette.performUpkeep(checkData);
        const txReciept = await tx.wait(1);
        const requestId = txReciept.events[1].args.requestId;
        if (network.config.chainId == 31337) {
            await mockVrf(requestId, roulette);
        }
    } else {
        console.log("upkeep not needed");
    }
}

async function mockVrf(requestId, roulette) {
    console.log("Fulfilling random words for a localhost");
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, roulette.address);
    console.log("RandomWords fulfilled");
}