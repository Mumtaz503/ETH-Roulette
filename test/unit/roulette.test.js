const { expect, assert } = require("chai");
const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Roulette unit tests", function () {
        let roulette,
            vrfCoordinatorV2Mock,
            deployer,
            deployerSigner,
            player,
            playerSigner,
            player2,
            player2Signer,
            entranceFee,
            interval;
        const chainId = network.config.chainId;

        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer;
            deployerSigner = ethers.provider.getSigner(deployer);
            player = (await getNamedAccounts()).player;
            playerSigner = ethers.provider.getSigner(player);
            player2 = (await getNamedAccounts()).player2;
            player2Signer = ethers.provider.getSigner(player2);
            await deployments.fixture(["mocks", "roulette"]);
            roulette = await ethers.getContract("Roulette", deployer);
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
            entranceFee = ethers.utils.parseUnits("2700000000000000", "wei");
            interval = await roulette.getInterval();
        });

        describe("enterRoulette", function () {
            it("Expect game state to be close", async function () {
                const gameState = await roulette.getGameState();
                assert.equal(gameState.toString(), 1);
            });
            it("Reverts if you don't pay entrance fee", async function () {
                await expect(roulette.enterRoulette()).to.be.revertedWith("Roulette__NotEnoughEntranceFee");
            });
            it("Expect Game state to be open when entrant pays the fee", async function () {
                await roulette.connect(playerSigner).enterRoulette({ value: entranceFee });
                await new Promise((resolve) => setTimeout(resolve, 1000));
                const gameState = await roulette.getGameState();
                assert.equal(gameState.toString(), "0");
            });
            it("Listen for the emitted event GameEntered", async function () {
                await expect(roulette.connect(playerSigner).enterRoulette({ value: entranceFee })
                ).to.emit(roulette, "GameEntered");
            });
        });
        describe("placeBet", function () {
            beforeEach(async function () {
                await roulette.connect(playerSigner).enterRoulette({ value: entranceFee });
            });
            it("Checks if the game is Open", async function () {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                const gameState = await roulette.getGameState();
                assert.equal(gameState.toString(), 0);
            });
            it("Checks if it is an inside bet or not", async function () {
                const betPlaced = ethers.utils.parseEther("0.027");
                const bet = {
                    player: player,
                    betElements: ["1R", "2B", "3R", "4B", "5R", "6B", "7R", "8B", "9R", "10B", "11B", "12R"],
                    betAmount: betPlaced,
                    isInsideBet: true,
                }

                await expect(roulette.connect(playerSigner).placeBet(bet, { value: betPlaced })
                ).to.be.revertedWith("Roulette__InvalidInsideBet");
            });
            it("Reverts if appropriate min bet is not placed", async function () {
                const betPlaced = ethers.utils.parseEther("0.010");
                const bet = {
                    player: player,
                    betElements: ["8B", "11B"],
                    betAmount: betPlaced,
                    isInsideBet: true,
                }

                const bet2 = {
                    player: player,
                    betElements: ["1R", "2B", "3R", "4B", "5R", "6B", "7R", "8B", "9R", "10B", "11B", "12R"],
                    betAmount: betPlaced,
                    isInsideBet: false,
                }

                await expect(roulette.connect(playerSigner).placeBet(bet, { value: betPlaced })
                ).to.be.revertedWith("Roulette__MinBetNotPlaced");

                await expect(roulette.connect(playerSigner).placeBet(bet2, { value: betPlaced })
                ).to.be.revertedWith("Roulette__MinOutsideBetNotPlaced");
            });
            it("Reverts if the element doesn't exist in the table", async function () {
                const betToBePlaced = ethers.utils.parseEther("0.027");
                const bet = {
                    player: player,
                    betElements: ["null"],
                    betAmount: betToBePlaced,
                    isInsideBet: true,
                }
                await expect(roulette.connect(playerSigner).placeBet(bet, { value: betToBePlaced })
                ).to.be.revertedWith("Roulette__ElementDoesntExist");
            });
            it("Should store the bet", async function () {
                const betToBePlaced = ethers.utils.parseEther("0.027");
                const bet = {
                    player: player,
                    betElements: ["8B", "9R", "11B", "12R"],
                    betAmount: betToBePlaced,
                    isInsideBet: true,
                }
                await roulette.connect(playerSigner).placeBet(bet, { value: betToBePlaced });

                const storedBet = await roulette.getBets();
                assert.equal(storedBet[0].player, bet.player);
                assert.deepEqual(storedBet[0].betElements, bet.betElements);
                assert.ok(storedBet[0].betAmount.eq(bet.betAmount), "Bet amount mismatch");
                assert.equal(storedBet[0].isInsideBet, bet.isInsideBet);
            });
            it("Should revert if an invalid bet is placed", async function () {
                const betAmount = ethers.utils.parseEther("0.027");
                const bet = {
                    player: player,
                    betElements: ["1R", "2B", "3R", "4B", "5R", "6B", "7R", "8B", "9R", "10B", "11B", "12R"],
                    betAmount: betAmount,
                    isInsideBet: true,
                }
                await expect(roulette.connect(playerSigner).placeBet(bet, { value: betAmount })
                ).to.be.revertedWith("Roulette__InvalidInsideBet");
            });
            it("Should emit the event BetPlaced", async function () {
                const betAmount = ethers.utils.parseEther("0.030");
                const bet = {
                    player: player,
                    betElements: ["1R", "2B", "3R", "4B", "5R", "6B", "7R", "8B", "9R", "10B", "11B", "12R"],
                    betAmount: betAmount,
                    isInsideBet: false,
                }
                await expect(roulette.connect(playerSigner).placeBet(bet, { value: betAmount })
                ).to.emit(roulette, "BetPlaced");
            });
            it("Shouldn't allow someone else to place Bet", async function () {
                const betAmount = ethers.utils.parseEther("0.030");
                const bet = {
                    player: player,
                    betElements: ["1R", "2B", "3R", "4B", "5R", "6B", "7R", "8B", "9R", "10B", "11B", "12R"],
                    betAmount: betAmount,
                    isInsideBet: false,
                }

                await expect(roulette.connect(player2Signer).placeBet(bet, { value: betAmount })
                ).to.be.revertedWith("Roulette__NotValidPlayer");
            });
        });
        describe("checkUpkeep", function () {
            it("Returns false if no one has entered the game or haven't sent enough ETH", async function () {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.request({ method: "evm_mine", params: [] });
                const { upkeepNeeded } = await roulette.callStatic.checkUpkeep("0x");
                assert(!upkeepNeeded);
            });
            it("Returns false if someone has entered the game but hasn't placed any bets", async function () {
                await roulette.connect(player2Signer).enterRoulette({ value: entranceFee });
                const { upkeepNeeded } = await roulette.callStatic.checkUpkeep("0x");
                assert(!upkeepNeeded);
            });
            it("Returns true if a player has entered the game and placed a bet", async function () {
                await roulette.connect(playerSigner).enterRoulette({ value: entranceFee });
                const betAmountPlaced = ethers.utils.parseEther("0.050");
                const bet = {
                    player: player,
                    betElements: ["13B", "14R", "15B", "16R", "17B", "18R"],
                    betAmount: betAmountPlaced,
                    isInsideBet: true,
                }
                await roulette.connect(playerSigner).placeBet(bet, { value: betAmountPlaced });

                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.request({ method: "evm_mine", params: [] });
                const { upkeepNeeded } = await roulette.callStatic.checkUpkeep("0x");
                expect(upkeepNeeded).to.be.true;
            });
            it("Should return false if the bet state is calculating", async function () {
                await roulette.connect(playerSigner).enterRoulette({ value: entranceFee });
                const betAmountPlaced = ethers.utils.parseEther("0.050");
                const bet = {
                    player: player,
                    betElements: ["13B", "14R", "15B", "16R", "17B", "18R"],
                    betAmount: betAmountPlaced,
                    isInsideBet: true,
                }
                await roulette.connect(playerSigner).placeBet(bet, { value: betAmountPlaced });

                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.request({ method: "evm_mine", params: [] });

                await roulette.performUpkeep([]);
                const betState = await roulette.getBetState();

                const { upkeepNeeded } = await roulette.callStatic.checkUpkeep("0x");
                assert.equal(betState.toString() == "1", upkeepNeeded == false);
            });
        });
        describe("performUpkeep", function () {
            beforeEach(async function () {
                await roulette.connect(playerSigner).enterRoulette({ value: entranceFee });
            });
            it("Should only be called if checkUpkeep returns true", async function () {
                const betAmountPlaced = ethers.utils.parseEther("0.030");
                const bet = {
                    player: player,
                    betElements: ["1R", "2B", "3R", "4B", "5R", "6B", "7R", "8B", "9R", "10B", "11B", "12R"],
                    betAmount: betAmountPlaced,
                    isInsideBet: false,
                }
                await roulette.connect(playerSigner).placeBet(bet, { value: betAmountPlaced });

                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.request({ method: "evm_mine", params: [] });

                const tx = await roulette.performUpkeep("0x");
                assert(tx);
            });
            it("Reverts if checkUpkeep returns false", async function () {
                await expect(roulette.performUpkeep("0x")).to.be.revertedWith("Roulette__UpkeepNotNeeded");
            });
            it("Should update the bet state and return a request Id", async function () {
                const betAmountPlaced = ethers.utils.parseEther("0.030");
                const bet = {
                    player: player,
                    betElements: ["1R", "2B", "3R", "4B", "5R", "6B", "7R", "8B", "9R", "10B", "11B", "12R"],
                    betAmount: betAmountPlaced,
                    isInsideBet: false,
                }
                await roulette.connect(playerSigner).placeBet(bet, { value: betAmountPlaced });

                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.request({ method: "evm_mine", params: [] });

                const transactionResponse = await roulette.performUpkeep("0x");
                const transactionReciept = await transactionResponse.wait(1);
                const betState = await roulette.getBetState();
                const requestId = transactionReciept.events[1].args.requestId;

                assert(requestId.toNumber() > 0);
                assert(betState == 1);
            });
            it("Should not allow players to place bets if the time has passed", async function () {
                const betAmountPlaced = ethers.utils.parseEther("0.030");
                const bet = {
                    player: player,
                    betElements: ["1R", "2B", "3R", "4B", "5R", "6B", "7R", "8B", "9R", "10B", "11B", "12R"],
                    betAmount: betAmountPlaced,
                    isInsideBet: false,
                }

                await roulette.connect(playerSigner).placeBet(bet, { value: betAmountPlaced });

                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.request({ method: "evm_mine", params: [] });
                await roulette.performUpkeep("0x");

                await expect(roulette.connect(playerSigner).placeBet(bet, { value: betAmountPlaced })
                ).to.be.revertedWith("Roulette__NotAllowedToPlaceBets");
            });
        });
        describe("fulfillRandomWords", function () {
            beforeEach(async function () {
                const entrance = ethers.utils.parseEther("1");
                await roulette.connect(playerSigner).enterRoulette({ value: entrance });
                const betAmountPlaced = ethers.utils.parseEther("0.030");
                const bet = {
                    player: player,
                    betElements: ["13B", "14R", "15B", "16R", "17B", "18R", "19R", "20B", "21R", "22B", "23R", "24B"],
                    betAmount: betAmountPlaced,
                    isInsideBet: false,
                }
                //["13B", "14R", "15B", "16R", "17B", "18R", "19R", "20B", "21R", "22B", "23R", "24B"],
                await roulette.connect(playerSigner).placeBet(bet, { value: betAmountPlaced });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.request({ method: "evm_mine", params: [] });
            });
            it("Can only be called after performUpkeep", async function () {
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, roulette.address)
                ).to.be.revertedWith("nonexistent request");
            });

            //Dat massive promise test *sigh*
            it("Should select a random element from the table, look for it in the bets, check if the player won",
                async function () {
                    const startingTimeStamp = await roulette.getLastTimeStamp();

                    await new Promise(async (resolve, reject) => {
                        roulette.once("BetWon", async () => {
                            console.log("Bet Won event found");
                            //check the fulfillRanomWords function with the usage of s_bets and s_wonBets
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
                                reject(error);
                            }

                        });
                        roulette.once("BetLost", async () => {
                            console.log("bet lost event found");
                            const wonBets = await roulette.getWonBets();
                            const bets = await roulette.getBets();
                            const betState = await roulette.getBetState();
                            assert(bets.length == 0);
                            assert(wonBets.length == 0);
                            assert.strictEqual(betState, 0);
                            resolve();
                        });
                        const transactionResponse = await roulette.performUpkeep("0x");
                        const transactionReciept = await transactionResponse.wait(1);
                        const requestId = transactionReciept.events[1].args.requestId;
                        await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, roulette.address);
                    });
                });
        });
    });


