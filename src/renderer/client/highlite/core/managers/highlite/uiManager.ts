export enum UIManagerScope {
  ClientRelative,
  ClientInternal,
  ClientOverlay,
}

export class UIManager {
  private static instance: UIManager;

  constructor() {
    if (UIManager.instance) {
      return UIManager.instance;
    }
    UIManager.instance = this;
    document.highlite.managers.UIManager = this;
  }

  private preventDefault(e: Event) {
    e.preventDefault();
    e.stopPropagation();
  }

  bindOnClickBlockHsMask(element: HTMLElement, callback: (e: Event) => void) {
    element.addEventListener("click", (e) => {
      callback(e);
      this.preventDefault(e);
    });
    element.addEventListener("pointerdown",  this.preventDefault);
    element.addEventListener("pointerup",  this.preventDefault);
  }

  // Create Element
  createElement(scope: UIManagerScope): HTMLElement {
    const element = document.createElement("div");
    element.classList.add("highlite-ui");
    switch (scope) {
      case UIManagerScope.ClientRelative:
        element.classList.add("highlite-ui-client-relative");

        element.addEventListener("keydown", (e) => {
          e.stopPropagation();
        });
        element.addEventListener("keyup", (e) => {
          e.stopPropagation();
        });
        element.addEventListener("keyup", (e) => {
          e.stopPropagation();
        });
        element.addEventListener("keypress", (e) => {
          e.stopPropagation();
        });

        document.getElementById("main")?.appendChild(element);
        break;
      case UIManagerScope.ClientInternal:
        element.classList.add("highlite-ui-client-internal");
        if (!document.getElementById("hs-screen-mask")) {
          throw new Error("Highlite UI Manager: #hs-screen-mask not found");
        } else {
          document.getElementById("hs-screen-mask")?.appendChild(element);
        }
        break;
      case UIManagerScope.ClientOverlay:
        element.classList.add("highlite-ui-client-overlay");
        document.body?.appendChild(element);
        break;
    }
    return element;
  }
}
