const { assert, expect } = require("chai")
const { getNamedAccounts, ethers, network } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")


developmentChains.includes(network.name)
    ? describe.skip
    : describe("Roulette Staging Tests", function () {
        let roulette, entranceFee, deployer, player, deployerSigner, playerSigner;
        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer;
            player = (await getNamedAccounts()).player;
            deployerSigner = ethers.provider.getSigner(deployer);
            playerSigner = ethers.provider.getSigner(player);
            roulette = await ethers.getContract("Roulette", deployer);
            entranceFee = ethers.utils.parseEther("1"); //Because we need to send some money to the contract if
            //the player wins

        });
        describe("fulfillRandomWords", function () {
            it("Works with live Chainlink Automation and VRF and we check if the player won", async function () {
                const startingTimeStamp = await roulette.getLastTimeStamp();

                await new Promise(async (resolve, reject) => {
                    roulette.once("BetWon", async () => {
                        console.log("Bet Won event Found");
                        try {
                            const bets = await roulette.getBets();
                            const betState = await roulette.getBetState();
                            const latestTimeStamp = await roulette.getLastTimeStamp();
                            const betAmountPlaced = ethers.utils.parseEther("0.030");
                            const initialBalanceOfPlayer = await ethers.provider.getBalance(player);
                            assert(bets.length == 0);
                            assert.strictEqual(betState, 0);
                            assert(latestTimeStamp.toString() > startingTimeStamp.toString());
                            //assert(wonBets.length > 0);

                            //call to the handlePayout to send money to the winner
                            await roulette.handlePayout();

                            const playerBalance = await roulette.getPlayerBalance(player);
                            const balanceOfPlayer = await ethers.provider.getBalance(player);
                            const wonBets = await roulette.getWonBets();

                            assert.equal(playerBalance.toString(), (betAmountPlaced.mul(2)).toString());
                            assert.equal(balanceOfPlayer.toString(),
                                (betAmountPlaced.mul(2)).add(initialBalanceOfPlayer).toString());
                            await assert.equal(wonBets.length, 0);

                            //call to withdraw to send money to the owner
                            const initialDeployerBalance = await roulette.provider.getBalance(deployer);
                            const startingRouletteBalance = await roulette.provider.getBalance(roulette.address);

                            const txResponse = await roulette.connect(deployerSigner).withdrawFunds();
                            const txReciept = await txResponse.wait(1);
                            const { gasUsed, effectiveGasPrice } = txReciept;
                            const gasCost = gasUsed.mul(effectiveGasPrice);

                            const finalRouletteBalance = await roulette.provider.getBalance(roulette.address);
                            const finalDeployerBalance = await roulette.provider.getBalance(deployer);

                            assert.equal(finalRouletteBalance, 0);
                            assert.equal(startingRouletteBalance.add(initialDeployerBalance).toString(),
                                finalDeployerBalance.add(gasCost).toString());
                            resolve();
                        } catch (error) {
                            reject(error)
                        }
                    });
                    roulette.once("BetLost", async () => {
                        console.log("BetLost Event Found");
                        console.log("bet lost event found");
                        const wonBets = await roulette.getWonBets();
                        const bets = await roulette.getBets();
                        const betState = await roulette.getBetState();
                        assert(bets.length == 0);
                        assert(wonBets.length == 0);
                        assert.strictEqual(betState, 0);
                        resolve();
                    });
                });
                await roulette.connect(playerSigner).enterRoulette({ value: entranceFee });
                console.log("Entered Roulette");
                const betAmountPlaced = ethers.utils.parseEther("0.030");
                const bet = {
                    player: player,
                    betElements: ["13B", "14R", "15B", "16R", "17B", "18R", "19R", "20B", "21R", "22B", "23R", "24B"],
                    betAmount: betAmountPlaced,
                    isInsideBet: false,
                }
                const tx = await roulette.connect(playerSigner).placeBet(bet, { value: betAmountPlaced });
                await tx.wait(1);
                console.log("Successfully placed bet, waiting on chainlink Automation...");
            })
        });
    });