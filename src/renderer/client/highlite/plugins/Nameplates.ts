import { Vector3 } from "@babylonjs/core/Maths/math";
import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class"
import { SettingsTypes } from "../core/interfaces/highlite/plugin/pluginSettings.interface";

export class Nameplates extends Plugin {
    pluginName = "Nameplates";
    author = "Highlite";
    DOMElement: HTMLDivElement | null = null;
    
    constructor() {
        super();

        // Nameplate toggles
        this.settings.playerNameplates = { text: "Player Nameplates", type: SettingsTypes.checkbox, value: true, callback: () => {} };
        this.settings.npcNameplates = { text: "NPC Nameplates", type: SettingsTypes.checkbox, value: true, callback: () => {} };
        this.settings.youNameplate = { text: "You Nameplate", type: SettingsTypes.checkbox, value: true, callback: () => {} };
        this.settings.groundItemNameplates = { text: "Ground Item Nameplates", type: SettingsTypes.checkbox, value: true, callback: () => {} };

        // Size settings
        this.settings.playerNameplateSize = { text: "Player Nameplate Text Size", type: SettingsTypes.range, value: 12, callback: () => this.updateAllFontSizes() };
        this.settings.npcNameplateSize = { text: "NPC Nameplate Text Size", type: SettingsTypes.range, value: 12, callback: () => this.updateAllFontSizes() };
        this.settings.youNameplateSize = { text: "You Nameplate Text Size", type: SettingsTypes.range, value: 12, callback: () => this.updateAllFontSizes() };
        this.settings.groundItemNameplateSize = { text: "Ground Item Nameplate Text Size", type: SettingsTypes.range, value: 12, callback: () => this.updateAllFontSizes() };
    }

    NPCDomElements: {
        [key: string]: { element: HTMLDivElement, position: Vector3 }
    } = {}
    
    PlayerDomElements: {
        [key: string]: { element: HTMLDivElement, position: Vector3 }
    } = {}
    
    GroundItemDomElements: {
        [key: string]: { element: HTMLDivElement, position: Vector3, itemName: string, quantity: number, positionKey: string }
    } = {}

    private positionTracker: Map<string, number> = new Map();

    init(): void {
        this.log("Initializing");
    }

    start(): void {
        this.log("Started");
        if (this.settings.enable.value) {
            this.setupAllElements();
        }
    }

    stop(): void {
        this.log("Stopped");
        this.cleanupAllElements();
    }

    SocketManager_loggedIn(): void {
        if (this.settings.enable.value) {
            this.setupAllElements();
        }
    }

    SocketManager_handleLoggedOut(): void {
        this.cleanupAllElements();
    }

    GameLoop_draw(): void {
        const NPCS = this.gameHooks.EntityManager.Instance._npcs;
        const Players = this.gameHooks.EntityManager.Instance._players;
        const MainPlayer = this.gameHooks.EntityManager.Instance.MainPlayer;
        const GroundItems = this.gameHooks.GroundItemManager.Instance.GroundItems;
        const playerFriends = this.gameHooks.ChatManager.Instance._friends;
        const BW = (document as any).client.get("BW");

        if (!this.settings.enable.value) {
            this.cleanupAllElements();
            return;
        }

        this.resetPositionTracker();

        if (!NPCS || !Players || !MainPlayer || !GroundItems) {
            this.log("Missing required game entities, skipping nameplate rendering.");
            return;
        }

        this.cleanupStaleEntities(NPCS, Players, MainPlayer);
        this.processNPCs(NPCS, MainPlayer, BW);
        this.processPlayers(Players, MainPlayer, playerFriends);
        this.processGroundItems(GroundItems);
    }

    private cleanupStaleEntities(NPCS: Map<number, any>, Players: any[], MainPlayer: any): void {
        // Cleanup stale NPCs
        for (const key in this.NPCDomElements) {
            if (!NPCS.has(parseInt(key))) {
                this.disposeElementFromCollection(this.NPCDomElements, key);
            }
        }

        // Cleanup stale Players
        for (const key in this.PlayerDomElements) {
            const exists = Players.some(p => p._entityId === parseInt(key)) || (MainPlayer && MainPlayer._entityId === parseInt(key));
            if (!exists) {
                this.disposeElementFromCollection(this.PlayerDomElements, key);
            }
        }

        // Cleanup stale Ground Items - this will be handled in processGroundItems
        // since ground items use grouped keys, not individual item IDs
    }

    private processNPCs(NPCS: Map<number, any>, MainPlayer: any, BW: any): void {
        if (!this.settings.npcNameplates!.value) {
            this.cleanupElementCollection(this.NPCDomElements);
            return;
        }

        for (const [key, npc] of NPCS) {
            if (!this.NPCDomElements[key]) {
                this.createNPCElement(key, npc, MainPlayer._combatLevel, BW);
            }

            // Update position for stacking calculation
            const worldPos = this.getEntityWorldPosition(npc, 'npc');
            if (worldPos) {
                this.NPCDomElements[key].position = worldPos;
                
                // Track position for stacking
                const positionKey = this.getPositionKey(worldPos);
                const currentCount = this.positionTracker.get(positionKey) || 0;
                this.positionTracker.set(positionKey, currentCount + 1);
            }

            const npcMesh = npc._appearance._haloNode;
            
            try {
                this.updateElementPosition(npcMesh, this.NPCDomElements[key]);
            } catch (e) {
                this.log("Error updating NPC element position: ", e);
            }
        }
    }

    private processPlayers(Players: any[], MainPlayer: any, playerFriends: string[]): void {
        if (this.settings.playerNameplates!.value) {
            for (const player of Players) {
                if (!this.PlayerDomElements[player._entityId]) {
                    this.createPlayerElement(player._entityId, player, false);
                }

                // Update friend status
                const isFriend = playerFriends.includes(player._nameLowerCase);
                this.PlayerDomElements[player._entityId].element.style.color = isFriend ? "lightgreen" : "white";

                // Update position for stacking calculation
                const worldPos = this.getEntityWorldPosition(player, 'player');
                if (worldPos) {
                    this.PlayerDomElements[player._entityId].position = worldPos;
                    
                    // Track position for stacking
                    const positionKey = this.getPositionKey(worldPos);
                    const currentCount = this.positionTracker.get(positionKey) || 0;
                    this.positionTracker.set(positionKey, currentCount + 1);
                }

                const playerMesh = player._appearance._haloNode;
                try {
                    this.updateElementPosition(playerMesh, this.PlayerDomElements[player._entityId]);
                } catch (e) {
                    this.log("Error updating Player element position: ", e);
                }
            }
        } else {
            // Only cleanup non-main player elements
            for (const key in this.PlayerDomElements) {
                if (MainPlayer && parseInt(key) !== MainPlayer._entityId) {
                    this.disposeElementFromCollection(this.PlayerDomElements, key);
                }
            }
        }

        // Handle main player nameplate
        if (this.settings.youNameplate!.value && MainPlayer) {
            if (!this.PlayerDomElements[MainPlayer._entityId]) {
                this.createPlayerElement(MainPlayer._entityId, MainPlayer, true);
            }

            // Update position for stacking calculation
            const worldPos = this.getEntityWorldPosition(MainPlayer, 'player');
            if (worldPos) {
                this.PlayerDomElements[MainPlayer._entityId].position = worldPos;
                
                // Track position for stacking
                const positionKey = this.getPositionKey(worldPos);
                const currentCount = this.positionTracker.get(positionKey) || 0;
                this.positionTracker.set(positionKey, currentCount + 1);
            }

            const playerMesh = MainPlayer._appearance._haloNode;
            try {
                this.updateElementPosition(playerMesh, this.PlayerDomElements[MainPlayer._entityId]);
            } catch (e) {
                this.log("Error updating Player element position: ", e);
            }
        } else if (!this.settings.youNameplate!.value && MainPlayer && this.PlayerDomElements[MainPlayer._entityId]) {
            this.disposeElementFromCollection(this.PlayerDomElements, MainPlayer._entityId);
        }
    }

    private processGroundItems(GroundItems: Map<number, any>): void {
        if (!this.settings.groundItemNameplates!.value) {
            this.cleanupElementCollection(this.GroundItemDomElements);
            return;
        }

        const positionGroups = this.groupGroundItemsByPosition(GroundItems);
        this.cleanupUnusedGroundItemElements(positionGroups);

        for (const [positionKey, positionGroup] of positionGroups) {
            const representativeKey = positionGroup.firstKey;
            
            // Check if element exists and if the content has changed
            const existingElement = this.GroundItemDomElements[representativeKey];
            const needsUpdate = !existingElement || 
                               existingElement.quantity !== positionGroup.totalItems ||
                               existingElement.itemName !== `${positionGroup.items.size} types`;

            if (needsUpdate) {
                // Remove existing element if it exists
                if (existingElement) {
                    this.disposeElementFromCollection(this.GroundItemDomElements, representativeKey);
                }
                
                // Create new element
                this.createGroundItemElement(representativeKey, positionGroup, positionKey);
            }

            const firstItem = Array.from(positionGroup.items.values())[0].items[0];
            
            // Update position for stacking calculation
            const worldPos = this.getEntityWorldPosition(firstItem.item, 'grounditem');
            if (worldPos) {
                this.GroundItemDomElements[representativeKey].position = worldPos;
                
                // Track position for stacking
                const stackingPositionKey = this.getPositionKey(worldPos);
                const currentCount = this.positionTracker.get(stackingPositionKey) || 0;
                this.positionTracker.set(stackingPositionKey, currentCount + 1);
            }
            
            const groundItemMesh = firstItem.item._appearance._billboardMesh;
            
            try {
                this.updateElementPosition(groundItemMesh, this.GroundItemDomElements[representativeKey]);
            } catch (e) {
                this.log("Error updating Ground Item element position: ", e);
            }
        }
    }

    private createNPCElement(key: number, npc: any, playerCombatLevel: number, BW: any): void {
        const element = document.createElement('div');
        element.id = `highlite-nameplates-npc-${key}`;
        element.style.position = "absolute";
        element.style.pointerEvents = "none";
        element.style.zIndex = "1000";
        element.style.display = "flex";
        element.style.flexDirection = "column";
        element.style.justifyContent = "center";
        element.style.fontSize = `${this.settings.npcNameplateSize!.value}px`;

        // Create Name
        const nameSpan = document.createElement("div");
        nameSpan.style.color = "yellow";
        nameSpan.style.textAlign = "center";
        nameSpan.style.fontSize = `${this.settings.npcNameplateSize!.value}px`;
        nameSpan.innerText = npc._name;
        element.appendChild(nameSpan);

        // Create Level if applicable
        if (npc._combatLevel != 0) {
            const lvlSpan = document.createElement("div");
            lvlSpan.style.textAlign = "center";
            lvlSpan.style.fontSize = `${this.settings.npcNameplateSize!.value}px`;
            lvlSpan.innerText = `Lvl. ${npc._combatLevel}`;
            lvlSpan.className = BW.getTextColorClassNameForCombatLevelDifference(playerCombatLevel, npc._combatLevel);

            // Add aggression emojis
            if (npc._def._combat._isAggressive && !npc._def._combat._isAlwaysAggro) {
                lvlSpan.innerText += " 😠";
            } else if (!npc._def._combat._isAggressive && !npc._def._combat._isAlwaysAggro) {
                lvlSpan.innerText += " 😐";
            } else if (npc._def._combat._isAlwaysAggro) {
                lvlSpan.innerText += " 👿";
            }

            element.appendChild(lvlSpan);
        }

        this.NPCDomElements[key] = {
            element: element,
            position: Vector3.ZeroReadOnly
        };

        document.getElementById('highlite-nameplates')?.appendChild(element);
    }

    private createPlayerElement(entityId: number, player: any, isMainPlayer: boolean): void {
        const element = document.createElement('div');
        element.id = `highlite-nameplates-player-${entityId}`;
        element.style.position = "absolute";
        element.style.pointerEvents = "none";
        element.style.zIndex = "1000";
        element.style.color = isMainPlayer ? "cyan" : "white";
        element.style.fontSize = isMainPlayer ? `${this.settings.youNameplateSize!.value}px` : `${this.settings.playerNameplateSize!.value}px`;
        element.innerHTML = player._name;

        this.PlayerDomElements[entityId] = {
            element: element,
            position: Vector3.ZeroReadOnly
        };

        document.getElementById('highlite-nameplates')?.appendChild(element);
    }

    private createGroundItemElement(representativeKey: string, positionGroup: any, positionKey: string): void {
        const element = document.createElement('div');
        element.id = `highlite-nameplates-grounditem-${representativeKey}`;
        element.style.position = "absolute";
        element.style.pointerEvents = "none";
        element.style.zIndex = "1000";
        element.style.display = "flex";
        element.style.flexDirection = "column";
        element.style.justifyContent = "center";
        element.style.fontSize = `${this.settings.groundItemNameplateSize!.value}px`;

        const entries = Array.from(positionGroup.items.entries()) as [string, any][];
        entries.sort(([a], [b]) => a.localeCompare(b));

        for (const [itemName, itemGroup] of entries) {
            const itemDiv = document.createElement("div");
            itemDiv.style.color = "orange";
            itemDiv.style.textAlign = "center";
            itemDiv.style.fontSize = `${this.settings.groundItemNameplateSize!.value}px`;
            itemDiv.innerText = itemGroup.count > 1 ? `${itemName} [x${itemGroup.count}]` : itemName;
            element.appendChild(itemDiv);
        }

        this.GroundItemDomElements[representativeKey] = {
            element: element,
            position: Vector3.ZeroReadOnly,
            itemName: `${positionGroup.items.size} types`,
            quantity: positionGroup.totalItems,
            positionKey: positionKey
        };

        document.getElementById('highlite-nameplates')?.appendChild(element);
    }

    private groupGroundItemsByPosition(GroundItems: Map<number, any>): Map<string, { items: Map<string, { items: any[], count: number }>, firstKey: string, totalItems: number }> {
        const positionGroups = new Map();

        for (const [key, groundItem] of GroundItems) {
            const worldPos = this.getEntityWorldPosition(groundItem, 'grounditem');
            if (!worldPos) continue;

            const positionKey = `${Math.round(worldPos.x * 2) / 2}_${Math.round(worldPos.z * 2) / 2}`;

            if (!positionGroups.has(positionKey)) {
                positionGroups.set(positionKey, { items: new Map(), firstKey: String(key), totalItems: 0 });
            }

            const positionGroup = positionGroups.get(positionKey)!;
            const itemName = groundItem._def._nameCapitalized;

            if (!positionGroup.items.has(itemName)) {
                positionGroup.items.set(itemName, { items: [], count: 0 });
            }

            positionGroup.items.get(itemName)!.items.push({ key: String(key), item: groundItem });
            positionGroup.items.get(itemName)!.count++;
            positionGroup.totalItems++;
        }

        return positionGroups;
    }

    private cleanupUnusedGroundItemElements(positionGroups: Map<string, any>): void {
        // Get all currently active representative keys
        const activeRepresentativeKeys = new Set<string>();
        for (const [, positionGroup] of positionGroups) {
            activeRepresentativeKeys.add(positionGroup.firstKey);
        }
        
        // Remove elements that are no longer active
        for (const key in this.GroundItemDomElements) {
            if (!activeRepresentativeKeys.has(key)) {
                this.disposeElementFromCollection(this.GroundItemDomElements, key);
            }
        }
    }

    private getEntityWorldPosition(entity: any, entityType: 'player' | 'npc' | 'grounditem'): Vector3 | null {
        if (!entity || !entity._appearance) {
            return null;
        }

        if (entityType === 'grounditem') {
            return entity._appearance._billboardMesh?.getAbsolutePosition() || null;
        } else {
            return entity._appearance._haloNode?.getAbsolutePosition() || null;
        }
    }

    private resetPositionTracker(): void {
        this.positionTracker.clear();
    }

    private getPositionKey(worldPosition: Vector3): string {
        // Round to consistent grid for stacking with a small threshold
        // This prevents minor position changes from causing restacking
        const roundedX = Math.round(worldPosition.x * 2) / 1.5; // Half tile precision with 0.5 unit threshold
        const roundedZ = Math.round(worldPosition.z * 2) / 1.5;
        return `${roundedX}_${roundedZ}`;
    }

    private updateElementPosition(entityMesh: any, domElement: any): void {
        const translationCoordinates = Vector3.Project(
            Vector3.ZeroReadOnly,
            entityMesh.getWorldMatrix(),
            this.gameHooks.GameEngine.Instance.Scene.getTransformMatrix(),
            this.gameHooks.GameCameraManager.Camera.viewport.toGlobal(
                this.gameHooks.GameEngine.Instance.Engine.getRenderWidth(1),
                this.gameHooks.GameEngine.Instance.Engine.getRenderHeight(1)
            )
        );

        const camera = this.gameHooks.GameCameraManager.Camera;
        const isInFrustrum = camera.isInFrustum(entityMesh);

        if (!isInFrustrum) {
            domElement.element.style.visibility = "hidden";
        } else {
            domElement.element.style.visibility = "visible";
        }

        // Calculate stacking offset
        const heightOffset = this.calculateStackingOffset(domElement);

        domElement.element.style.transform = `translate3d(calc(${this.pxToRem(translationCoordinates.x)}rem - 50%), calc(${this.pxToRem(translationCoordinates.y - 30 - heightOffset)}rem - 50%), 0px)`;
    }

    private calculateStackingOffset(domElement: any): number {
        if (!domElement.position) {
            return 0;
        }

        const positionKey = this.getPositionKey(domElement.position);
        
        // Collect all elements at this position
        const elementsAtPosition: Array<{ element: HTMLDivElement, id: string, type: string }> = [];
        
        // Add NPCs at this position
        for (const [key, npcElement] of Object.entries(this.NPCDomElements)) {
            if (npcElement.position && this.getPositionKey(npcElement.position) === positionKey) {
                elementsAtPosition.push({
                    element: npcElement.element,
                    id: `npc_${key}`,
                    type: 'npc'
                });
            }
        }
        
        // Add Players at this position
        for (const [key, playerElement] of Object.entries(this.PlayerDomElements)) {
            if (playerElement.position && this.getPositionKey(playerElement.position) === positionKey) {
                elementsAtPosition.push({
                    element: playerElement.element,
                    id: `player_${key}`,
                    type: 'player'
                });
            }
        }
        
        // Add Ground Items at this position
        for (const [key, groundElement] of Object.entries(this.GroundItemDomElements)) {
            if (groundElement.position && this.getPositionKey(groundElement.position) === positionKey) {
                elementsAtPosition.push({
                    element: groundElement.element,
                    id: `ground_${key}`,
                    type: 'ground'
                });
            }
        }

        if (elementsAtPosition.length <= 1) {
            return 0;
        }

        // Sort by type priority (ground items first, then NPCs, then players) and then by ID for consistency
        elementsAtPosition.sort((a, b) => {
            const typePriority = { ground: 0, npc: 1, player: 2 };
            const priorityDiff = typePriority[a.type as keyof typeof typePriority] - typePriority[b.type as keyof typeof typePriority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.id.localeCompare(b.id);
        });

        // Find the index of the current element
        const currentElementId = domElement.element.id;
        const index = elementsAtPosition.findIndex(el => el.element.id === currentElementId);
        
        return index * 25; // 25px spacing per stacked element
    }

    private pxToRem(px: number): number {
        return px / 16;
    }

    private updateAllFontSizes(): void {
        // Update NPC font sizes
        for (const key in this.NPCDomElements) {
            const element = this.NPCDomElements[key].element;
            element.style.fontSize = `${this.settings.npcNameplateSize!.value}px`;
            
            // Update all child elements (name and level) font sizes as well
            const childElements = element.children;
            for (let i = 0; i < childElements.length; i++) {
                const childElement = childElements[i] as HTMLElement;
                childElement.style.fontSize = `${this.settings.npcNameplateSize!.value}px`;
            }
        }

        // Update player font sizes
        for (const key in this.PlayerDomElements) {
            const element = this.PlayerDomElements[key].element;
            const isMainPlayer = element.style.color === "cyan";
            const fontSize = isMainPlayer ? this.settings.youNameplateSize!.value : this.settings.playerNameplateSize!.value;
            element.style.fontSize = `${fontSize}px`;
        }

        // Update ground item font sizes
        for (const key in this.GroundItemDomElements) {
            const element = this.GroundItemDomElements[key].element;
            element.style.fontSize = `${this.settings.groundItemNameplateSize!.value}px`;
            
            // Update all child elements (individual item lines) font sizes as well
            const childElements = element.children;
            for (let i = 0; i < childElements.length; i++) {
                const childElement = childElements[i] as HTMLElement;
                childElement.style.fontSize = `${this.settings.groundItemNameplateSize!.value}px`;
            }
        }
    }

    private disposeElementFromCollection(collection: any, key: string | number): void {
        if (collection[key]?.element) {
            collection[key].element.remove();
            delete collection[key];
        }
    }

    private cleanupElementCollection(collection: any): void {
        for (const key in collection) {
            if (collection[key]) {
                collection[key].element.remove();
                delete collection[key];
            }
        }
    }

    private cleanupAllElements(): void {
        this.cleanupElementCollection(this.NPCDomElements);
        this.cleanupElementCollection(this.PlayerDomElements);
        this.cleanupElementCollection(this.GroundItemDomElements);

        this.NPCDomElements = {};
        this.PlayerDomElements = {};
        this.GroundItemDomElements = {};

        if (this.DOMElement) {
            this.DOMElement.remove();
            this.DOMElement = null;
        }
    }

    private setupAllElements(): void {
        this.cleanupAllElements();
        this.DOMElement = document.createElement('div');
        this.DOMElement.id = "highlite-nameplates";
        this.DOMElement.style.position = "absolute";
        this.DOMElement.style.pointerEvents = "none";
        this.DOMElement.style.zIndex = "1";
        this.DOMElement.style.overflow = "hidden";
        this.DOMElement.style.width = "100%";
        this.DOMElement.style.height = "100%";
        this.DOMElement.style.fontFamily = "Inter";
        this.DOMElement.style.fontSize = "12px";
        this.DOMElement.style.fontWeight = "bold";
        document.getElementById('hs-screen-mask')?.appendChild(this.DOMElement);
    }
}
