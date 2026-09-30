import { Item } from "../../../domain/entities/Item.js";

export type QualityStatus = "ok" | "warning" | "error";

export interface QualityCheck {
  key: string;
  label: string;
  status: QualityStatus;
  detail: string;
  suggestion?: string;
}

export class AnalyzeItemQualityUseCase {
  private static readonly DESCRIPTION_MIN_LENGTH = 100;

  public execute(item: Item): QualityCheck[] {
    return [
      this.checkTitleBrand(item),
      this.checkTitleModel(item),
      this.checkImages(item),
      this.checkVideo(item),
      this.checkDescription(item),
      this.checkFreeShipping(item),
      this.checkStock(item),
    ];
  }

  private getAttribute(item: Item, name: string): string | null | undefined {
    const attr = item.attributes.find(
      (a) => a.name.toLowerCase() === name.toLowerCase()
    );
    return attr === undefined ? undefined : (attr.value_name ?? null);
  }

  private checkTitleAttribute(
    item: Item,
    attrName: string,
    key: string,
    label: string
  ): QualityCheck {
    const value = this.getAttribute(item, attrName);
    if (value === undefined) {
      return {
        key,
        label,
        status: "error",
        detail: `Atributo "${attrName}" no encontrado`,
        suggestion: `Completá el atributo ${attrName} en la publicación`,
      };
    }
    if (!value) {
      return {
        key,
        label,
        status: "error",
        detail: `El atributo "${attrName}" no tiene valor`,
        suggestion: `Completá el valor del atributo ${attrName} en la publicación`,
      };
    }
    const inTitle = item.title.toLowerCase().includes(value.toLowerCase());
    return {
      key,
      label,
      status: inTitle ? "ok" : "error",
      detail: inTitle
        ? `"${value}" encontrado en el título`
        : `"${value}" no está en el título`,
      suggestion: inTitle ? undefined : `Agregá "${value}" al título`,
    };
  }

  private checkTitleBrand(item: Item): QualityCheck {
    return this.checkTitleAttribute(item, "Marca", "title_brand", "Título incluye marca");
  }

  private checkTitleModel(item: Item): QualityCheck {
    return this.checkTitleAttribute(item, "Modelo", "title_model", "Título incluye modelo");
  }

  private checkImages(item: Item): QualityCheck {
    const count = item.pictures.length;
    if (count >= 4) {
      return {
        key: "images",
        label: "Imágenes suficientes",
        status: "ok",
        detail: `${count} imágenes`,
      };
    }
    if (count >= 1) {
      return {
        key: "images",
        label: "Imágenes suficientes",
        status: "warning",
        detail: `${count} imagen${count > 1 ? "es" : ""}`,
        suggestion: "ML recomienda al menos 4 imágenes desde distintos ángulos",
      };
    }
    return {
      key: "images",
      label: "Imágenes suficientes",
      status: "error",
      detail: "Sin imágenes",
      suggestion: "Agregá fotos de alta calidad desde distintos ángulos",
    };
  }

  private checkVideo(item: Item): QualityCheck {
    if (item.videoId) {
      return {
        key: "video",
        label: "Video",
        status: "ok",
        detail: "Video cargado",
      };
    }
    return {
      key: "video",
      label: "Video",
      status: "warning",
      detail: "Sin video",
      suggestion: "Un video mejora la confianza del comprador",
    };
  }

  private checkDescription(item: Item): QualityCheck {
    const len = item.descriptionText.length;
    if (len > AnalyzeItemQualityUseCase.DESCRIPTION_MIN_LENGTH) {
      return {
        key: "description",
        label: "Descripción completa",
        status: "ok",
        detail: `${len} caracteres`,
      };
    }
    if (len > 0) {
      return {
        key: "description",
        label: "Descripción completa",
        status: "warning",
        detail: `${len} caracteres`,
        suggestion:
          "Ampliá la descripción con especificaciones y beneficios del producto",
      };
    }
    return {
      key: "description",
      label: "Descripción completa",
      status: "error",
      detail: "Sin descripción",
      suggestion:
        "Agregá una descripción detallada para reducir preguntas y reclamos",
    };
  }

  private checkFreeShipping(item: Item): QualityCheck {
    if (item.freeShipping) {
      return {
        key: "free_shipping",
        label: "Envío gratis",
        status: "ok",
        detail: "Envío gratis activo",
      };
    }
    return {
      key: "free_shipping",
      label: "Envío gratis",
      status: "warning",
      detail: "Sin envío gratis",
      suggestion:
        "Ofrecé envío gratis para aparecer más arriba en los resultados",
    };
  }

  private checkStock(item: Item): QualityCheck {
    if (item.availableQuantity > 0) {
      return {
        key: "stock",
        label: "Stock disponible",
        status: "ok",
        detail: `${item.availableQuantity} unidades`,
      };
    }
    return {
      key: "stock",
      label: "Stock disponible",
      status: "error",
      detail: "Sin stock",
      suggestion:
        "Actualizá el stock para que la publicación sea visible",
    };
  }
}
