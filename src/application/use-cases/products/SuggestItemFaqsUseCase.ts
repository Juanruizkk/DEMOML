import { IMeliClient } from "../../interfaces/IMeliClient.js";
import { ItemAttribute } from "../../../domain/entities/Item.js";

export interface SuggestedFaq {
  question: string;
  answer: string;
  sourceAttribute?: string;
  category?: string;
}

export interface SuggestItemFaqsResult {
  itemId: string;
  itemTitle: string;
  price: number;
  currencyId: string;
  attributes: ItemAttribute[];
  descriptionText: string;
  suggestedFaqs: SuggestedFaq[];
}

export class SuggestItemFaqsUseCase {
  constructor(private readonly meliClient: IMeliClient) {}

  public async execute(sellerId: string, itemId: string): Promise<SuggestItemFaqsResult> {
    if (!sellerId || !itemId) {
      throw new Error("sellerId e itemId son requeridos");
    }

    const item = await this.meliClient.getItem(sellerId, itemId);
    if (!item) {
      throw new Error(`No se encontró el producto ${itemId}`);
    }

    const attributes = item.attributes || [];
    const suggestedFaqs: SuggestedFaq[] = [];

    // Helper to generate Q&A from attributes
    const addFaqFromAttr = (attr: ItemAttribute, q: string, a: string, cat: string = "Especificaciones") => {
      if (attr.value_name && !suggestedFaqs.some((f) => f.question.toLowerCase() === q.toLowerCase())) {
        suggestedFaqs.push({
          question: q,
          answer: a,
          sourceAttribute: attr.name,
          category: cat,
        });
      }
    };

    for (const attr of attributes) {
      const name = (attr.name || "").toLowerCase().trim();
      const val = (attr.value_name || "").trim();
      if (!val || val === "N/A" || val === "No aplica") continue;

      if (name.includes("garantía") || name.includes("garantia")) {
        addFaqFromAttr(attr, "¿Tiene garantía oficial?", `Sí, cuenta con ${val} de garantía oficial de fábrica.`, "Garantía");
      } else if (name.includes("marca")) {
        addFaqFromAttr(attr, "¿De qué marca es?", `El producto es marca original ${val}.`, "General");
      } else if (name.includes("modelo")) {
        addFaqFromAttr(attr, "¿Qué modelo específico es?", `Corresponde al modelo ${val}.`, "General");
      } else if (name.includes("color")) {
        addFaqFromAttr(attr, "¿De qué color es el producto?", `El color disponible en esta publicación es ${val}.`, "Diseño & Color");
      } else if (name.includes("voltaje") || name.includes("tensión") || name.includes("alimentación")) {
        addFaqFromAttr(attr, "¿Qué voltaje o alimentación requiere?", `Funciona con ${val}.`, "Técnico");
      } else if (name.includes("conectividad") || name.includes("conexión") || name.includes("interfaz")) {
        addFaqFromAttr(attr, "¿Qué tipo de conectividad posee?", `Cuenta con conectividad ${val}.`, "Conectividad");
      } else if (name.includes("inalámbrico") || name.includes("inalambrico")) {
        const isYes = val.toLowerCase().includes("sí") || val.toLowerCase().includes("si") || val.toLowerCase() === "true";
        addFaqFromAttr(attr, "¿Es inalámbrico o con cable?", isYes ? "Sí, es inalámbrico." : "No, se conecta mediante cable.", "Conectividad");
      } else if (name.includes("batería") || name.includes("bateria") || name.includes("autonomía") || name.includes("autonomia")) {
        addFaqFromAttr(attr, "¿Qué autonomía o duración de batería tiene?", `Tiene una autonomía de ${val}.`, "Batería");
      } else if (name.includes("bluetooth")) {
        const isYes = val.toLowerCase().includes("sí") || val.toLowerCase().includes("si") || val.toLowerCase() === "true";
        addFaqFromAttr(attr, "¿Tiene Bluetooth?", isYes ? "Sí, cuenta con conectividad Bluetooth." : `Bluetooth: ${val}.`, "Conectividad");
      } else if (name.includes("compatib") || name.includes("sistema operativo") || name.includes("plataforma")) {
        addFaqFromAttr(attr, "¿Con qué dispositivos o sistemas es compatible?", `Es compatible con ${val}.`, "Compatibilidad");
      } else if (name.includes("incluye") || name.includes("accesorios incluidos") || name.includes("contenido")) {
        addFaqFromAttr(attr, "¿Qué accesorios incluye la caja?", `Incluye ${val}.`, "Contenido");
      } else if (name.includes("dimens") || name.includes("medidas") || name.includes("alto") || name.includes("ancho")) {
        addFaqFromAttr(attr, `¿Cuáles son las medidas (${attr.name})?`, `${attr.name}: ${val}.`, "Dimensiones");
      } else if (name.includes("peso")) {
        addFaqFromAttr(attr, "¿Cuánto pesa el producto?", `El peso es de ${val}.`, "Dimensiones");
      } else if (name.includes("material")) {
        addFaqFromAttr(attr, "¿De qué material está fabricado?", `Está confeccionado en ${val}.`, "Materiales");
      } else if (name.includes("capacidad") || name.includes("almacenamiento") || name.includes("memoria")) {
        addFaqFromAttr(attr, `¿Qué capacidad (${attr.name}) tiene?`, `Cuenta con ${val} de capacidad.`, "Técnico");
      } else if (name.includes("origen") || name.includes("fabricación")) {
        addFaqFromAttr(attr, "¿Cuál es el país de origen?", `Es de origen ${val}.`, "General");
      }
    }

    // Default stock FAQ
    if (item.availableQuantity > 0) {
      suggestedFaqs.push({
        question: "¿Tienen stock disponible para entrega o envío?",
        answer: `Sí, contamos con stock disponible (unidades listas para entrega o despacho inmediato).`,
        sourceAttribute: "Stock",
        category: "Disponibilidad",
      });
    }

    // Default condition FAQ
    if (item.condition) {
      const condText = item.condition === "new" ? "nuevo, 100% original en caja cerrada" : "usado";
      suggestedFaqs.push({
        question: "¿El producto es nuevo y sellado?",
        answer: `Sí, el producto es ${condText}.`,
        sourceAttribute: "Condición",
        category: "General",
      });
    }

    return {
      itemId: item.id,
      itemTitle: item.title,
      price: item.price,
      currencyId: item.currencyId,
      attributes,
      descriptionText: item.descriptionText || "",
      suggestedFaqs,
    };
  }
}
