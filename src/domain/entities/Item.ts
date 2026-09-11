export interface ItemAttribute {
  id?: string;
  name: string;
  value_name: string | null;
}

export interface ItemProps {
  id: string; // e.g. MLA123456789
  sellerId?: string;
  title: string;
  price: number;
  currencyId: string;
  availableQuantity: number;
  condition: string;
  attributes: ItemAttribute[];
  descriptionText: string;
  permalink?: string;
  cachedAt?: number;
}

export class Item {
  public readonly id: string;
  public readonly sellerId?: string;
  public readonly title: string;
  public readonly price: number;
  public readonly currencyId: string;
  public readonly availableQuantity: number;
  public readonly condition: string;
  public readonly attributes: ItemAttribute[];
  public readonly descriptionText: string;
  public readonly permalink?: string;
  public readonly cachedAt: number;

  constructor(props: ItemProps) {
    this.id = props.id;
    this.sellerId = props.sellerId;
    this.title = props.title;
    this.price = props.price;
    this.currencyId = props.currencyId;
    this.availableQuantity = props.availableQuantity;
    this.condition = props.condition;
    this.attributes = props.attributes || [];
    this.descriptionText = props.descriptionText || "";
    this.permalink = props.permalink;
    this.cachedAt = props.cachedAt || Date.now();
  }

  public isCacheValid(ttlMs: number = 5 * 60 * 1000): boolean {
    return Date.now() - this.cachedAt < ttlMs;
  }
}
