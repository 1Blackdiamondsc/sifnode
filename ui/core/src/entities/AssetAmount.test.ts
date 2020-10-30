import { AssetAmount } from "./AssetAmount";
import { Network } from "./Network";
import { Coin } from "./Coin";
import JSBI from "jsbi";

const USD = Coin({
  symbol: "USD",
  decimals: 2,
  name: "US Dollar",
  network: Network.ETHEREUM,
});

const ETH = Coin({
  symbol: "ETH",
  decimals: 18,
  name: "Ethereum",
  network: Network.ETHEREUM,
});

test("it should be able to handle whole integars", () => {
  const f = AssetAmount(USD, JSBI.BigInt("10012"));
  expect(f.toFixed(2)).toBe("100.12");
});

test("Shorthand", () => {
  expect(AssetAmount(USD, "100.12").toFixed()).toBe("100.12");
  expect(AssetAmount(ETH, "10.1234567").toFixed()).toBe(
    "10.123456700000000000"
  );
});

test("Formatted", () => {
  const f = AssetAmount(USD, "100.12");
  expect(f.toFormatted()).toBe("100.12 USD");
});