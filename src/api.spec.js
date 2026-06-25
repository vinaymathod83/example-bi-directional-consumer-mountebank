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
  FlexiPredicate,
  HttpMethod,
  NotFoundResponse,
} from "@anev/ts-mountebank";

describe("API Contract Test", () => {
  const mb = new Mountebank();
  const api = new ProductAPIClient(`http://localhost:${imposterPort}`);

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
      const imposter = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true);

      imposter.withStub(
        new Stub()
          .withPredicate(
            new EqualPredicate()
              .withMethod(HttpMethod.GET)
              .withPath("/products")
          )
          .withResponse(
            new Response().withStatusCode(200).withJSONBody([expectedProduct])
          )
      );
      await mb.createImposter(imposter);

      // make request to Pact mock server
      const products = await api.getAllProducts();

      // assert that we got the expected response
      expect(products).toStrictEqual([new Product(expectedProduct)]);
    });
  });

  describe("retrieving a product", () => {
    test("ID 10 exists", async () => {
      // Arrange
      const imposter = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true);

      imposter.withStub(
        new Stub()
          .withPredicate(
            new EqualPredicate()
              .withMethod(HttpMethod.GET)
              .withPath("/product/10")
          )
          .withResponse(
            new Response().withStatusCode(200).withJSONBody(expectedProduct)
          )
      );
      await mb.createImposter(imposter);

      // Act
      const product = await api.getProduct("10");

      // Assert - did we get the expected response
      expect(product).toStrictEqual(new Product(expectedProduct));
    });

    test("product does not exist", async () => {
      // Arrange
      const imposter = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true);

      imposter.withStub(new Stub().withResponse(new NotFoundResponse()));
      await mb.createImposter(imposter);

      // Act + Assert
      await expect(api.getProduct("11")).rejects.toThrow(
        "Request failed with status code 404"
      );
    });
  });

  describe("handling errors", () => {
    test("server error returns 500", async () => {
      // Arrange
      const imposter = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true);

      imposter.withStub(
        new Stub()
          .withPredicate(
            new EqualPredicate()
              .withMethod(HttpMethod.GET)
              .withPath("/product/error")
          )
          .withResponse(
            new Response()
              .withStatusCode(500)
              .withJSONBody({ error: "Internal Server Error" })
          )
      );
      await mb.createImposter(imposter);

      // Act + Assert
      await expect(api.getProduct("error")).rejects.toThrow(
        "Request failed with status code 500"
      );
    });

    test("bad request returns 400", async () => {
      // Arrange
      const imposter = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true);

      imposter.withStub(
        new Stub()
          .withPredicate(
            new EqualPredicate()
              .withMethod(HttpMethod.GET)
              .withPath("/product/invalid")
          )
          .withResponse(
            new Response()
              .withStatusCode(400)
              .withJSONBody({ error: "Bad Request" })
          )
      );
      await mb.createImposter(imposter);

      // Act + Assert
      await expect(api.getProduct("invalid")).rejects.toThrow(
        "Request failed with status code 400"
      );
    });
  });

  describe("handling multiple products", () => {
    test("getAllProducts returns multiple products", async () => {
      // Arrange
      const multipleProducts = [
        { id: "1", type: "SAVINGS", price: 0 },
        { id: "2", type: "CHECKING", price: 25 },
        { id: "3", type: "CREDIT_CARD", price: 42 },
      ];

      const imposter = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true);

      imposter.withStub(
        new Stub()
          .withPredicate(
            new EqualPredicate()
              .withMethod(HttpMethod.GET)
              .withPath("/products")
          )
          .withResponse(
            new Response().withStatusCode(200).withJSONBody(multipleProducts)
          )
      );
      await mb.createImposter(imposter);

      // Act
      const products = await api.getAllProducts();

      // Assert
      expect(products).toHaveLength(3);
      expect(products.map(p => p.id)).toEqual(["1", "2", "3"]);
      expect(products).toStrictEqual(
        multipleProducts.map(p => new Product(p))
      );
    });

    test("getAllProducts returns empty array", async () => {
      // Arrange
      const imposter = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true);

      imposter.withStub(
        new Stub()
          .withPredicate(
            new EqualPredicate()
              .withMethod(HttpMethod.GET)
              .withPath("/products")
          )
          .withResponse(
            new Response().withStatusCode(200).withJSONBody([])
          )
      );
      await mb.createImposter(imposter);

      // Act
      const products = await api.getAllProducts();

      // Assert
      expect(products).toStrictEqual([]);
    });
  });

  describe("product validation", () => {
    test("product with missing price throws error", () => {
      // Act + Assert
      expect(() => {
        new Product({ id: "10", type: "CREDIT_CARD" });
      }).toThrow("id, name and type are required properties");
    });

    test("product with missing type throws error", () => {
      // Act + Assert
      expect(() => {
        new Product({ id: "10", price: 42 });
      }).toThrow("id, name and type are required properties");
    });

    test("product with missing id throws error", () => {
      // Act + Assert
      expect(() => {
        new Product({ type: "CREDIT_CARD", price: 42 });
      }).toThrow("id, name and type are required properties");
    });
  });

  describe("searching products", () => {
    test("search by type returns matching products", async () => {
      // Arrange
      const creditCards = [
        { id: "10", type: "CREDIT_CARD", price: 42 },
        { id: "20", type: "CREDIT_CARD", price: 50 },
      ];

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
            new Response().withStatusCode(200).withJSONBody(creditCards)
          )
      );
      await mb.createImposter(imposter);

      // Act
      const products = await api.searchProducts({ type: "CREDIT_CARD" });

      // Assert
      expect(products).toHaveLength(2);
      expect(products).toStrictEqual(creditCards.map(p => new Product(p)));
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
              .withQuery({ type: "NONEXISTENT" })
          )
          .withResponse(
            new Response().withStatusCode(200).withJSONBody([])
          )
      );
      await mb.createImposter(imposter);

      // Act
      const products = await api.searchProducts({ type: "NONEXISTENT" });

      // Assert
      expect(products).toStrictEqual([]);
    });
  });

  describe("filtering products by price", () => {
    test("filter products within price range", async () => {
      // Arrange
      const filteredProducts = [
        { id: "2", type: "CHECKING", price: 25 },
        { id: "10", type: "CREDIT_CARD", price: 42 },
      ];

      const imposter = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true);

      imposter.withStub(
        new Stub()
          .withPredicate(
            new FlexiPredicate()
              .withMethod(HttpMethod.GET)
              .withPath("/products/filter")
              .withQuery({ minPrice: "20", maxPrice: "50" })
          )
          .withResponse(
            new Response().withStatusCode(200).withJSONBody(filteredProducts)
          )
      );
      await mb.createImposter(imposter);

      // Act
      const products = await api.filterProductsByPrice(20, 50);

      // Assert
      expect(products).toHaveLength(2);
      expect(products).toStrictEqual(
        filteredProducts.map(p => new Product(p))
      );
    });

    test("filter with zero results returns empty array", async () => {
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
              .withQuery({ minPrice: "1000", maxPrice: "2000" })
          )
          .withResponse(
            new Response().withStatusCode(200).withJSONBody([])
          )
      );
      await mb.createImposter(imposter);

      // Act
      const products = await api.filterProductsByPrice(1000, 2000);

      // Assert
      expect(products).toStrictEqual([]);
    });
  });

  describe("getting products by type", () => {
    test("get all products of specific type", async () => {
      // Arrange
      const savingsProducts = [
        { id: "1", type: "SAVINGS", price: 0 },
        { id: "5", type: "SAVINGS", price: 0 },
      ];

      const imposter = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true);

      imposter.withStub(
        new Stub()
          .withPredicate(
            new EqualPredicate()
              .withMethod(HttpMethod.GET)
              .withPath("/products/type/SAVINGS")
          )
          .withResponse(
            new Response().withStatusCode(200).withJSONBody(savingsProducts)
          )
      );
      await mb.createImposter(imposter);

      // Act
      const products = await api.getProductsByType("SAVINGS");

      // Assert
      expect(products).toHaveLength(2);
      expect(products.every(p => p.type === "SAVINGS")).toBe(true);
      expect(products).toStrictEqual(
        savingsProducts.map(p => new Product(p))
      );
    });

    test("get products by type with no results", async () => {
      // Arrange
      const imposter = new Imposter()
        .withPort(imposterPort)
        .withRecordRequests(true);

      imposter.withStub(
        new Stub()
          .withPredicate(
            new EqualPredicate()
              .withMethod(HttpMethod.GET)
              .withPath("/products/type/UNKNOWN")
          )
          .withResponse(
            new Response().withStatusCode(200).withJSONBody([])
          )
      );
      await mb.createImposter(imposter);

      // Act
      const products = await api.getProductsByType("UNKNOWN");

      // Assert
      expect(products).toStrictEqual([]);
    });
  });
});
