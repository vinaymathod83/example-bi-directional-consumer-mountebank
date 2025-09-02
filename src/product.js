export class Product {
  constructor({id, name, price}) {
    if (!id || !name || !price) {
      throw Error("id, name and type are required properties")
    }
    this.id = id
    this.name = name
    this.price = price
  }
}
