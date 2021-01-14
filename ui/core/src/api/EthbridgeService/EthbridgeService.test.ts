import createEthbridgeService from ".";
import { AssetAmount } from "../../entities";
import { getWeb3Provider } from "../../test/utils/getWeb3Provider";
import { advanceBlock } from "../../test/utils/advanceBlock";
import {
  createWaitForBalance,
  createWaitForBalanceEth,
} from "../../test/utils/waitForBalance";
import { juniper, akasha, ethAccounts } from "../../test/utils/accounts";
import {
  createTestEthService,
  createTestSifService,
} from "../../test/utils/services";
import { getBalance, getTestingTokens } from "../../test/utils/getTestingToken";
import config from "../../config.localnet.json";
import Web3 from "web3";
import JSBI from "jsbi";

const [ETH, CETH, ATK, CATK, ROWAN, EROWAN] = getTestingTokens([
  "ETH",
  "CETH",
  "ATK",
  "CATK",
  "ROWAN",
  "EROWAN",
]);

async function waitFor(getter: () => Promise<any>, expected: any) {
  let value: any;
  for (let i = 0; i < 100; i++) {
    value = await getter();
    if (value.toString() === expected.toString()) {
      return;
    }
  }
  throw new Error(`${value.toString()} never was ${expected.toString()}`);
}

describe("PeggyService", () => {
  let EthbridgeService: ReturnType<typeof createEthbridgeService>;

  beforeEach(async () => {
    EthbridgeService = createEthbridgeService({
      sifApiUrl: "http://localhost:1317",
      sifWsUrl: "ws://localhost:26667/nosocket",
      sifChainId: "sifchain",
      bridgebankContractAddress: config.bridgebankContractAddress,
      getWeb3Provider,
    });
  });

  // This is not working so skipping
  // test.skip("lock and burn eth <-> ceth", async () => {
  //   // Setup services
  //   const sifService = await createTestSifService(akasha);
  //   const ethService = await createTestEthService();
  //   const waitForBalance = createWaitForBalance(sifService);
  //   const waitForBalanceEth = createWaitForBalanceEth(ethService);
  //   const web3 = new Web3(await getWeb3Provider());

  //   // Check the balance
  //   const cethBalance = getBalance(
  //     await sifService.getBalance(akasha.address),
  //     "ceth"
  //   ).toBaseUnits();

  //   // Send funds to the smart contract
  //   await new Promise<void>(async done => {
  //     EthbridgeService.lockToSifchain(akasha.address, AssetAmount(ETH, "2"), 10)
  //       .onComplete(async () => {
  //         // Check they arrived
  //         await waitForBalance(
  //           "ceth",
  //           JSBI.add(
  //             cethBalance,
  //             AssetAmount(ETH, "2").toBaseUnits()
  //           ).toString(),
  //           akasha.address,
  //           50
  //         );
  //         done();
  //       })
  //       .onError(err => {
  //         throw err.payload;
  //       });
  //     advanceBlock(100);
  //   });

  //   const accounts = await web3.eth.getAccounts();
  //   const ethereumRecipient = accounts[0];
  //   const recipientBalanceBefore = await web3.eth.getBalance(ethereumRecipient);

  //   const ethereumChainId = await web3.eth.net.getId();
  //   const message = await EthbridgeService.burnToEthereum({
  //     fromAddress: akasha.address,
  //     assetAmount: AssetAmount(CETH, "2"),
  //     ethereumRecipient,
  //   });

  //   // Message has the expected format
  //   expect(message).toEqual({
  //     type: "cosmos-sdk/StdTx",
  //     value: {
  //       msg: [
  //         {
  //           type: "ethbridge/MsgBurn",
  //           value: {
  //             cosmos_sender: akasha.address,
  //             amount: "2000000000000000000",
  //             symbol: "ceth",
  //             ethereum_chain_id: `${ethereumChainId}`,
  //             ethereum_receiver: ethereumRecipient,
  //           },
  //         },
  //       ],
  //       fee: {
  //         amount: [],
  //         gas: "200000",
  //       },
  //       signatures: null,
  //       memo: "",
  //     },
  //   });

  //   await sifService.signAndBroadcast(message.value.msg);

  //   await waitForBalanceEth(
  //     "eth",
  //     JSBI.add(
  //       JSBI.BigInt(recipientBalanceBefore),
  //       JSBI.BigInt("2000000000000000000")
  //     ).toString(),
  //     ethereumRecipient,
  //     100
  //   );
  //   // // Check they arrived
  //   // expect(
  //   //   JSBI.equal(
  //   //     JSBI.BigInt(recipientBalanceAfter),
  //   //     JSBI.add(
  //   //       JSBI.BigInt(recipientBalanceBefore),
  //   //       JSBI.BigInt("2000000000000000000")
  //   //     )
  //   //   )
  //   // ).toBe(true);
  // });

  test("rowan -> erowan -> rowan", async () => {
    const sifService = await createTestSifService(juniper);
    const ethService = await createTestEthService();

    async function getERowanBalance() {
      return (
        await ethService.getBalance(ethAccounts[2].public, EROWAN)
      )[0].toBaseUnits();
    }

    async function getRowanBalance() {
      return (
        await sifService.getBalance(juniper.address, ROWAN)
      )[0].toBaseUnits();
    }

    ////////////////////////
    // Rowan -> eRowan
    ////////////////////////

    // First get balance in ethereum
    const startingERowanBalance = await getERowanBalance();

    // lock Rowan to eRowan
    const msg = await EthbridgeService.lockToEthereum({
      fromAddress: juniper.address,
      assetAmount: AssetAmount(ROWAN, "100"),
      ethereumRecipient: ethAccounts[2].public,
    });

    await sifService.signAndBroadcast(msg.value.msg);

    const expectedERowanBalance = JSBI.add(
      startingERowanBalance,
      AssetAmount(ROWAN, "100").toBaseUnits()
    );

    await waitFor(
      async () => (await getERowanBalance()).toString(),
      expectedERowanBalance
    );

    ////////////////////////
    // eRowan -> Rowan
    ////////////////////////
    const startingRowanBalance = (
      await ethService.getBalance(ethAccounts[2].public, EROWAN)
    )[0].toBaseUnits();

    const expectedRowanBalance = JSBI.add(
      startingRowanBalance,
      AssetAmount(ROWAN, "10").toBaseUnits()
    );

    // Burn eRowan to Rowan
    await new Promise<void>(done => {
      EthbridgeService.burnToSifchain(
        juniper.address,
        AssetAmount(EROWAN, "10"),
        50,
        ethAccounts[2].public
      )
        .onComplete(() => {
          done();
        })
        .onError(err => {
          throw err;
        });
      advanceBlock(52);
    });

    // wait for the balance to change
    await waitFor(
      async () => (await getRowanBalance()).toString(),
      expectedRowanBalance
    );
  });
});
