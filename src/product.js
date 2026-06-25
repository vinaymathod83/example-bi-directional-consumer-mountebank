export class Product {
  constructor({id, type, price}) {
    if (!id || !type || price === undefined || price === null) {
      throw Error("id, name and type are required properties")
    }
    this.id = id
    this.type = type
    this.price = price
  }
}
