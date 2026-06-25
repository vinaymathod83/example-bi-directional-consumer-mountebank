import { imposterPort } from "../test/config";
import { ProductAPIClient } from "./api";
import { Product } from "./product";
import { startAndClearStubs, writeStubs, stopStubs } from "../test/mountebank";

import {
  Response,
  Imposter,
  Mountebank,
  Stub,
  FlexiPredicate,
  HttpMethod,
} from "@anev/ts-mountebank";

describe("API Search Contract Test", () => {
  const mb = new Mountebank();
  const api = new ProductAPIClient(`http://localhost:${imposterPort}`);

  beforeAll(() => startAndClearStubs());
  afterEach(() => writeStubs(mb, imposterPort));
  afterAll(() => stopStubs());

  const expectedProducts = [
    {
      id: "10",
      type: "CREDIT_CARD",
      price: 42,
    },
    {
      id: "11",
      type: "DEBIT_CARD",
      price: 50,
    },
  ];

  describe("searching products by type", () => {
    test("search returns matching products", async () => {
      // Arrange
      const imposter = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true);

      imposter.withStub(
        new Stub()
          .withPredicate(
            new FlexiPredicate()
              .withMethod(HttpMethod.GET)
              .withPath("/products/search")
              .withQuery({ type: "CREDIT_CARD" })
          )
          .withResponse(
            new Response().withStatusCode(200).withJSONBody([expectedProducts[0]])
          )
      );
      await mb.createImposter(imposter);

      // make request to mock server
      const products = await api.searchProducts({ type: "CREDIT_CARD" });

      // assert that we got the expected response
      expect(products).toHaveLength(1);
      expect(products[0]).toStrictEqual(new Product(expectedProducts[0]));
    });

    test("search with no results returns empty array", async () => {
      // Arrange
      const imposter = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true);

      imposter.withStub(
        new Stub()
          .withPredicate(
            new FlexiPredicate()
              .withMethod(HttpMethod.GET)
              .withPath("/products/search")
              .withQuery({ type: "UNKNOWN_TYPE" })
          )
          .withResponse(
            new Response().withStatusCode(200).withJSONBody([])
          )
      );
      await mb.createImposter(imposter);

      // Act
      const products = await api.searchProducts({ type: "UNKNOWN_TYPE" });

      // Assert
      expect(products).toStrictEqual([]);
    });
  });

  describe("filtering products by price range", () => {
    test("filter returns products within price range", async () => {
      // Arrange
      const imposter = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true);

      imposter.withStub(
        new Stub()
          .withPredicate(
            new FlexiPredicate()
              .withMethod(HttpMethod.GET)
              .withPath("/products/filter")
              .withQuery({ minPrice: "40", maxPrice: "60" })
          )
          .withResponse(
            new Response().withStatusCode(200).withJSONBody(expectedProducts)
          )
      );
      await mb.createImposter(imposter);

      // Act
      const products = await api.filterProductsByPrice(40, 60);

      // Assert
      expect(products).toHaveLength(2);
      expect(products).toStrictEqual(
        expectedProducts.map(p => new Product(p))
      );
    });
  });
});
