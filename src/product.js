export class Product {
  constructor({id, type, price}) {
    if (!id || !type || !price) {
      throw Error("id, name and type are required properties")
    }
    this.id = id
    this.type = name
    this.price = price
  }
}
