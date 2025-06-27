export enum UIManagerScope {
  ClientRelative,
  ClientInternal,
  ClientOverlay,
}

export class UIManager {
  private static instance: UIManager;
  private itemTooltipEl: HTMLDivElement | null = null;
  private currentItemTooltipId: number | null = null;

  constructor() {
    if (UIManager.instance) {
      return UIManager.instance;
    }
    UIManager.instance = this;
    (document as any).highlite.managers.UIManager = this;
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



  private ensureItemTooltip() {
    // Check if tooltip exists AND is still attached to the DOM
    if (this.itemTooltipEl && this.itemTooltipEl.parentElement) {
      return;
    }
    
    // Remove old tooltip if it exists but is detached
    if (this.itemTooltipEl) {
      this.itemTooltipEl.remove();
      this.itemTooltipEl = null;
    }
    
    const screenMask = document.getElementById('hs-screen-mask');        
    this.itemTooltipEl = document.createElement('div');
    this.itemTooltipEl.className = 'hs-ui-item-tooltip';
    
    const container = screenMask || document.body;
    container.appendChild(this.itemTooltipEl);
  }

  private getSkillName(skillId: number): string {
    try {
      return (document as any).highlite.gameLookups.Skills[skillId] || `Skill ${skillId}`;
    } catch {
      return `Skill ${skillId}`;
    }
  }

  private getEquipmentTypeName(typeId: number): string {
    try {
      return (document as any).highlite.gameLookups.EquipmentTypes[typeId] || `Type ${typeId}`;
    } catch {
      return `Type ${typeId}`;
    }
  }

  /**
   * Draw an item tooltip at the specified coordinates
   * @param itemId - The item ID to display tooltip for
   * @param x - X coordinate (in pixels)
   * @param y - Y coordinate (in pixels)
   * @returns Object with hide() method to close the tooltip
   */
  drawItemTooltip(itemId: number, x: number, y: number): { hide: () => void } {
    this.ensureItemTooltip();
    
    if (!this.itemTooltipEl) {
      return { hide: () => {} };
    }

    this.currentItemTooltipId = itemId;

    let itemDef: any = null;
    try {
      itemDef = (document as any).highlite.gameHooks.ItemDefMap.ItemDefMap.get(itemId);
    } catch (error) {
      console.warn(`Error getting item definition for ID ${itemId}:`, error);
    }

    if (!itemDef) {
      console.warn(`No item definition found for ID ${itemId}`);
      return { hide: () => {} };
    }

    this.itemTooltipEl.innerHTML = '';

    // Header with sprite and title
    const header = document.createElement('div');
    header.className = 'hs-ui-item-tooltip-header';

    const spriteDiv = document.createElement('div');
    spriteDiv.className = 'hs-ui-item-tooltip-sprite';
    
    try {
      const pos = (document as any).highlite.gameHooks.ItemSpriteManager.getCSSBackgroundPositionForItem(itemId);
      if (pos) {
        spriteDiv.style.backgroundPosition = pos;
      }
    } catch (error) {
      console.warn(`Error getting item sprite for ID ${itemId}:`, error);
    }
    
    header.appendChild(spriteDiv);

    const titleDiv = document.createElement('div');
    titleDiv.className = 'hs-ui-item-tooltip-title';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'hs-ui-item-tooltip-name';
    nameDiv.textContent = itemDef._nameCapitalized || itemDef._name || `Item ${itemId}`;
    titleDiv.appendChild(nameDiv);

    const idDiv = document.createElement('div');
    idDiv.className = 'hs-ui-item-tooltip-id';
    idDiv.textContent = `ID: ${itemId}`;
    titleDiv.appendChild(idDiv);

    header.appendChild(titleDiv);
    this.itemTooltipEl.appendChild(header);

    // Description
    if (itemDef._description) {
      const descDiv = document.createElement('div');
      descDiv.className = 'hs-ui-item-tooltip-description';
      descDiv.textContent = itemDef._description;
      this.itemTooltipEl.appendChild(descDiv);
    }

    // Cost
    if (itemDef._cost && itemDef._cost > 0) {
      const costSection = document.createElement('div');
      costSection.className = 'hs-ui-item-tooltip-section';
      costSection.innerHTML = `<span class="hs-ui-item-tooltip-label">Cost:</span> <span class="hs-ui-item-tooltip-cost">${itemDef._cost.toLocaleString()} coins</span>`;
      this.itemTooltipEl.appendChild(costSection);
    }

    // Requirements
    if (itemDef._equippableRequirements && itemDef._equippableRequirements.length > 0) {
      const reqSection = document.createElement('div');
      reqSection.className = 'hs-ui-item-tooltip-section';
      reqSection.innerHTML = '<span class="hs-ui-item-tooltip-label">Requirements:</span>';
      
      itemDef._equippableRequirements.forEach((req: any) => {
        const reqDiv = document.createElement('div');
        reqDiv.className = 'hs-ui-item-tooltip-requirement';
        reqDiv.textContent = `• Level ${req._amount} ${this.getSkillName(req._skill)}`;
        reqSection.appendChild(reqDiv);
      });
      
      this.itemTooltipEl!.appendChild(reqSection);
    }

    // Equippable Effects
    if (itemDef._equippableEffects && itemDef._equippableEffects.length > 0) {
      const effectSection = document.createElement('div');
      effectSection.className = 'hs-ui-item-tooltip-section';
      effectSection.innerHTML = '<span class="hs-ui-item-tooltip-label">Equipment Effects:</span>';
      
      itemDef._equippableEffects.forEach((effect: any) => {
        const effectDiv = document.createElement('div');
        effectDiv.className = 'hs-ui-item-tooltip-effect';
        const sign = effect._amount > 0 ? '+' : '';
        effectDiv.textContent = `• ${sign}${effect._amount} ${this.getSkillName(effect._skill)}`;
        effectSection.appendChild(effectDiv);
      });
      
      this.itemTooltipEl!.appendChild(effectSection);
    }

    // Edible Effects
    if (itemDef._edibleEffects && itemDef._edibleEffects.length > 0) {
      const edibleSection = document.createElement('div');
      edibleSection.className = 'hs-ui-item-tooltip-section';
      edibleSection.innerHTML = '<span class="hs-ui-item-tooltip-label">Edible Effects:</span>';
      
      itemDef._edibleEffects.forEach((effect: any) => {
        const effectDiv = document.createElement('div');
        effectDiv.className = 'hs-ui-item-tooltip-effect';
        const sign = effect._amount > 0 ? '+' : '';
        effectDiv.textContent = `• ${sign}${effect._amount} ${this.getSkillName(effect._skill)}`;
        edibleSection.appendChild(effectDiv);
      });
      
      this.itemTooltipEl!.appendChild(edibleSection);
    }

    // Weapon Speed
    if (itemDef._weaponSpeed && itemDef._weaponSpeed > 0) {
      const speedSection = document.createElement('div');
      speedSection.className = 'hs-ui-item-tooltip-section';
      speedSection.innerHTML = `<span class="hs-ui-item-tooltip-label">Attack Speed:</span> <span class="hs-ui-item-tooltip-value">${itemDef._weaponSpeed}</span>`;
      this.itemTooltipEl.appendChild(speedSection);
    }

    // Equipment Type
    if (itemDef._equipmentType !== null && itemDef._equipmentType !== undefined) {
      const typeSection = document.createElement('div');
      typeSection.className = 'hs-ui-item-tooltip-section';
      typeSection.innerHTML = `<span class="hs-ui-item-tooltip-label">Type:</span> <span class="hs-ui-item-tooltip-value">${this.getEquipmentTypeName(itemDef._equipmentType)}</span>`;
      this.itemTooltipEl.appendChild(typeSection);
    }

    // Experience from obtaining
    if (itemDef._expFromObtaining && itemDef._expFromObtaining._skill !== undefined && itemDef._expFromObtaining._amount > 0) {
      const expSection = document.createElement('div');
      expSection.className = 'hs-ui-item-tooltip-section';
      expSection.innerHTML = '<span class="hs-ui-item-tooltip-label">Experience Gained:</span>';
      
      const expDiv = document.createElement('div');
      expDiv.className = 'hs-ui-item-tooltip-effect';
      expDiv.textContent = `• ${itemDef._expFromObtaining._amount} ${this.getSkillName(itemDef._expFromObtaining._skill)} XP`;
      expSection.appendChild(expDiv);
      
      this.itemTooltipEl!.appendChild(expSection);
    }

    // Recipe (if item has crafting recipe)
    if (itemDef._recipe && itemDef._recipe._ingredients && itemDef._recipe._ingredients.length > 0) {
      const recipeSection = document.createElement('div');
      recipeSection.className = 'hs-ui-item-tooltip-section';
      recipeSection.innerHTML = '<span class="hs-ui-item-tooltip-label">Recipe:</span>';
      
      itemDef._recipe._ingredients.forEach((ingredient: any) => {
        const ingredientDiv = document.createElement('div');
        ingredientDiv.className = 'hs-ui-item-tooltip-effect';
        try {
          const ingredientDef = (document as any).highlite.gameHooks.ItemDefMap.ItemDefMap.get(ingredient._itemId);
          const ingredientName = ingredientDef?._nameCapitalized || ingredientDef?._name || `Item ${ingredient._itemId}`;
          ingredientDiv.textContent = `• ${ingredient._amount}x ${ingredientName}`;
        } catch {
          ingredientDiv.textContent = `• ${ingredient._amount}x Item ${ingredient._itemId}`;
        }
        recipeSection.appendChild(ingredientDiv);
      });
      
      this.itemTooltipEl!.appendChild(recipeSection);
    }

    // Tags
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'hs-ui-item-tooltip-tags';

    if (itemDef._isMembers) {
      const tag = document.createElement('span');
      tag.className = 'hs-ui-item-tooltip-tag members';
      tag.textContent = 'Members';
      tagsDiv.appendChild(tag);
    }

    if (itemDef._isStackable) {
      const tag = document.createElement('span');
      tag.className = 'hs-ui-item-tooltip-tag stackable';
      tag.textContent = 'Stackable';
      tagsDiv.appendChild(tag);
    }

    if (itemDef._isTradeable) {
      const tag = document.createElement('span');
      tag.className = 'hs-ui-item-tooltip-tag tradeable';
      tag.textContent = 'Tradeable';
      tagsDiv.appendChild(tag);
    }

    if (itemDef._canIOU) {
      const tag = document.createElement('span');
      tag.className = 'hs-ui-item-tooltip-tag iou';
      tag.textContent = 'IOU';
      tagsDiv.appendChild(tag);
    }

    // Metal Type tag
    if (itemDef._metalType !== null && itemDef._metalType !== undefined) {
      const metalTypes = ['Bronze', 'Iron', 'Steel', 'Palladium', 'Gold', 'Coronium', 'Celadium'];
      const metalName = metalTypes[itemDef._metalType] || `Metal ${itemDef._metalType}`;
      const tag = document.createElement('span');
      tag.className = 'hs-ui-item-tooltip-tag';
      tag.textContent = metalName;
      tagsDiv.appendChild(tag);
    }

    if (tagsDiv.children.length > 0) {
      this.itemTooltipEl.appendChild(tagsDiv);
    }

    // Edible Result (what you get after eating)
    if (itemDef._edibleResult) {
      const resultSection = document.createElement('div');
      resultSection.className = 'hs-ui-item-tooltip-section';
      resultSection.innerHTML = '<span class="hs-ui-item-tooltip-label">After Eating:</span>';
      
      const resultDiv = document.createElement('div');
      resultDiv.className = 'hs-ui-item-tooltip-effect';
      try {
        const resultDef = (document as any).highlite.gameHooks.ItemDefMap.ItemDefMap.get(itemDef._edibleResult._itemId);
        const resultName = resultDef?._nameCapitalized || resultDef?._name || `Item ${itemDef._edibleResult._itemId}`;
        resultDiv.textContent = `• ${itemDef._edibleResult._amount}x ${resultName}`;
      } catch {
        resultDiv.textContent = `• ${itemDef._edibleResult._amount}x Item ${itemDef._edibleResult._itemId}`;
      }
      resultSection.appendChild(resultDiv);
      
      this.itemTooltipEl.appendChild(resultSection);
    }

    // Position and show tooltip
    this.itemTooltipEl.style.display = 'block';
    
    // Smart positioning - adjust if tooltip would go off-screen
    const tooltipRect = this.itemTooltipEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 10;
    
    let finalX = x + margin;
    let finalY = y - tooltipRect.height - margin;
    
    // Adjust X if tooltip would go off right edge
    if (finalX + tooltipRect.width > viewportWidth) {
      finalX = x - tooltipRect.width - margin;
    }
    
    // Adjust Y if tooltip would go off top edge
    if (finalY < 0) {
      finalY = y + margin;
    }
    
    // Ensure tooltip doesn't go off bottom edge
    if (finalY + tooltipRect.height > viewportHeight) {
      finalY = viewportHeight - tooltipRect.height - margin;
    }
    
    this.itemTooltipEl.style.left = finalX + 'px';
    this.itemTooltipEl.style.top = finalY + 'px';

    // Return object with hide method
    return {
      hide: () => {
        if (this.itemTooltipEl) {
          this.itemTooltipEl.style.display = 'none';
        }
        this.currentItemTooltipId = null;
      }
    };
  }

  /**
   * Hide any currently visible item tooltip
   */
  hideItemTooltip(): void {
    if (this.itemTooltipEl) {
      this.itemTooltipEl.style.display = 'none';
    }
    this.currentItemTooltipId = null;
  }

  /**
   * Get the currently displayed item tooltip ID
   */
  getCurrentItemTooltipId(): number | null {
    return this.currentItemTooltipId;
  }
}
