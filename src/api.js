const axios = require("axios");
const { Product } = require("./product");

export class ProductAPIClient {
  constructor(url) {
    if (url === undefined || url === "") {
      url = process.env.BASE_URL;
    }
    if (url.endsWith("/")) {
      url = url.substr(0, url.length - 1);
    }
    this.url = url;
  }

  withPath(path) {
    if (!path.startsWith("/")) {
      path = "/" + path;
    }
    return `${this.url}${path}`;
  }
  generateAuthToken() {
      return "Bearer " + new Date().toISOString()
  }
  async getAllProducts() {
    return axios
      .get(this.withPath("/products"), {
            headers: {
                "Authorization": this.generateAuthToken()
            }
        })
      .then((r) => r.data.map((p) => new Product(p)));
  }

  async getProduct(id) {
    return axios
      .get(this.withPath("/product/" + id), {
        headers: {
          "Authorization": this.generateAuthToken()
        }
      })
      .then((r) => new Product(r.data));
  }

  async searchProducts(type) {
    return axios
      .get(this.withPath("/products/search"), {
        params: { type },
        headers: { "Authorization": this.generateAuthToken() },
      })
      .then((r) => r.data.map((p) => new Product(p)));
  }

  async filterProducts(minPrice, maxPrice) {
    return axios
      .get(this.withPath("/products/filter"), {
        params: { minPrice, maxPrice },
        headers: { "Authorization": this.generateAuthToken() },
      })
      .then((r) => r.data.map((p) => new Product(p)));
  }

  async getProductsByType(type) {
    return axios
      .get(this.withPath("/products/type/" + type), {
        headers: { "Authorization": this.generateAuthToken() },
      })
      .then((r) => r.data.map((p) => new Product(p)));
  }

  async createProduct(product) {
    return axios
      .post(this.withPath("/products"), product, {
        headers: { "Authorization": this.generateAuthToken() },
      })
      .then((r) => new Product(r.data));
  }
}