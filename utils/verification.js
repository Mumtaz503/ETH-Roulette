const { run } = require("hardhat");

const verify = async function (contractAddress, args) {
    console.log("Verifyng Contract Please Wait....");

    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        })
    } catch (error) {
        if (error.message.toLowerCase().includes("already verified")) {
            console.log("Contract is already verified on etherscan");
        } else {
            console.log("Error while contract verification: ", error)
        }
    }
}

module.exports = { verify };