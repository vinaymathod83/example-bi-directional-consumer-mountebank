import { imposterPort } from "../test/config";
import { ProductAPIClient } from "./api";
import { Product } from "./product";
import { startAndClearStubs, writeStubs, stopStubs } from "../test/mountebank";

import {
  Response,
  Imposter,
  Mountebank,
  Stub,
  EqualPredicate,
  HttpMethod,
  NotFoundResponse,
} from "@anev/ts-mountebank";

describe("API Contract Test", () => {
  const mb = new Mountebank();
  const api = new ProductAPIClient(`http://localhost:${imposterPort}`);
  const imposter = new Imposter()
    .withPort(imposterPort)
    .withRecordRequests(true);

  beforeAll(() => startAndClearStubs());
  afterEach(() => writeStubs(mb, imposterPort));
  afterAll(() => stopStubs());

  const expectedProduct = {
    id: "10",
    type: "CREDIT_CARD",
    price: 42,
  };

  describe("retrieving products", () => {
    test("products exists", async () => {
      // Arrange
      imposter
        .withStub(
          new Stub()
            .withPredicate(
              new EqualPredicate()
                .withMethod(HttpMethod.GET)
                .withPath("/products")
            )
            .withResponse(
              new Response().withStatusCode(200).withJSONBody([expectedProduct])
            )
        )
      await mb.createImposter(imposter);

      // make request to Pact mock server
      const products = await api.getAllProducts();

      // assert that we got the expected response
      expect(products).toStrictEqual([new Product(expectedProduct)]);
    });
  });

  describe("retrieving a product", () => {
    beforeAll(async () => {
      // Arrange
      imposter
        .withStub(
          new Stub()
            .withPredicate(
              new EqualPredicate()
                .withMethod(HttpMethod.GET)
                .withPath("/product/10")
            )
            .withResponse(
              new Response().withStatusCode(200).withJSONBody(expectedProduct)
            )
        )
        .withStub(new Stub().withResponse(new NotFoundResponse()));

      await mb.createImposter(imposter);
    });

    test("ID 10 exists", async () => {
      // Act
      const product = await api.getProduct("10");

      // Assert - did we get the expected response
      expect(product).toStrictEqual(new Product(expectedProduct));
    });

    test("product does not exist", async () => {
      // Act + Assert
      await expect(api.getProduct("11")).rejects.toThrow(
        "Request failed with status code 404"
      );
    });
  });

  // The following cases are derived from pactflow/oas/products.yaml operations
  // (searchProducts, filterProducts, getProductsByType, createProduct) using
  // the spec's own examples. Each uses a fresh imposter so its stub is matched
  // in isolation (mountebank is first-match).

  describe("searching products by type (GET /products/search)", () => {
    test("returns products matching the type", async () => {
      // Arrange - OAS example query: type=CREDIT_CARD
      const searchStub = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true)
        .withStub(
          new Stub()
            .withPredicate(
              new EqualPredicate()
                .withMethod(HttpMethod.GET)
                .withPath("/products/search")
            )
            .withResponse(
              new Response().withStatusCode(200).withJSONBody([expectedProduct])
            )
        );
      await mb.createImposter(searchStub);

      // Act
      const products = await api.searchProducts("CREDIT_CARD");

      // Assert
      expect(products).toStrictEqual([new Product(expectedProduct)]);
    });
  });

  describe("filtering products by price range (GET /products/filter)", () => {
    test("returns products within the range", async () => {
      // Arrange - OAS example query: minPrice=20&maxPrice=50
      const filtered = [
        { id: "2", type: "CHECKING", price: 25 },
        { id: "10", type: "CREDIT_CARD", price: 42 },
      ];
      const filterStub = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true)
        .withStub(
          new Stub()
            .withPredicate(
              new EqualPredicate()
                .withMethod(HttpMethod.GET)
                .withPath("/products/filter")
            )
            .withResponse(
              new Response().withStatusCode(200).withJSONBody(filtered)
            )
        );
      await mb.createImposter(filterStub);

      // Act
      const products = await api.filterProducts("20", "50");

      // Assert
      expect(products).toStrictEqual(filtered.map((p) => new Product(p)));
    });
  });

  describe("retrieving products by type (GET /products/type/{type})", () => {
    test("returns all products of the given type", async () => {
      // Arrange - OAS example path param: SAVINGS
      const savings = [
        { id: "1", type: "SAVINGS", price: 0 },
        { id: "5", type: "SAVINGS", price: 0 },
      ];
      const typeStub = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true)
        .withStub(
          new Stub()
            .withPredicate(
              new EqualPredicate()
                .withMethod(HttpMethod.GET)
                .withPath("/products/type/SAVINGS")
            )
            .withResponse(
              new Response().withStatusCode(200).withJSONBody(savings)
            )
        );
      await mb.createImposter(typeStub);

      // Act
      const products = await api.getProductsByType("SAVINGS");

      // Assert
      expect(products).toStrictEqual(savings.map((p) => new Product(p)));
    });
  });

  describe("creating a product (POST /products)", () => {
    test("returns the created product", async () => {
      // Arrange - OAS request/response example
      const newProduct = { id: "1234", type: "food", price: 42 };
      const createStub = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true)
        .withStub(
          new Stub()
            .withPredicate(
              new EqualPredicate()
                .withMethod(HttpMethod.POST)
                .withPath("/products")
            )
            .withResponse(
              new Response().withStatusCode(200).withJSONBody(newProduct)
            )
        );
      await mb.createImposter(createStub);

      // Act
      const product = await api.createProduct(newProduct);

      // Assert
      expect(product).toStrictEqual(new Product(newProduct));
    });
  });
});