import { ContextMenuManager } from "./managers/game/contextMenuManager";
import { HookManager } from "./managers/highlite/hookManager";
import { NotificationManager } from "./managers/highlite/notificationManager";
import { PanelManager } from "./managers/highlite/panelManager";
import { PluginManager } from "./managers/highlite/pluginManger";
import { UIManager } from "./managers/highlite/uiManager";
import { SettingsManager } from "./managers/highlite/settingsManager";
import { DatabaseManager } from "./managers/highlite/databaseManager";
import { SoundManager } from "./managers/highlite/soundsManager";

export class Highlite {
    hookManager : HookManager;
    contextMenuManager : ContextMenuManager;
    notificationManager : NotificationManager;
    pluginManager : PluginManager;
    uiManager : UIManager;
    panelManager : PanelManager
    settingsManager : SettingsManager;
    databaseManager : DatabaseManager;
    soundManager : SoundManager;

    constructor() {
        console.info("[Highlite] Core Initializing!");

        document.highlite = {};
        document.highlite.managers = {};
        document.highlite.gameHooks = {};
        document.highlite.gameLookups = {};
        document.highlite.plugins = [];

        this.hookManager = new HookManager();
        this.contextMenuManager = new ContextMenuManager();
        this.notificationManager = new NotificationManager();
        this.pluginManager = new PluginManager();
        this.uiManager = new UIManager();
        this.panelManager = new PanelManager();
        this.soundManager = new SoundManager();
        this.settingsManager = new SettingsManager();
        this.databaseManager = new DatabaseManager();


        // Class Mappings
        this.hookManager.registerClass("Lk", "EntityManager");
        this.hookManager.registerClass("CN", "GroundItemManager");
        this.hookManager.registerClass("lF", "MeshManager"); // probably out of date
        this.hookManager.registerClass("mF", "WorldMapManager"); // probably out of date
        this.hookManager.registerClass("zR", "AtmosphereManager"); // probably out of date
        this.hookManager.registerClass("aD", "WorldEntityManager"); // probably out of date
        this.hookManager.registerClass("Mz", "SpellManager"); // probably out of date
        this.hookManager.registerClass("wk", "SpellMeshManager"); // probably out of date
        this.hookManager.registerClass("pW", "GameLoop");
        this.hookManager.registerClass("zG", "ChatManager");
        this.hookManager.registerClass("Dz", "RangeManager"); // probably out of date
        this.hookManager.registerClass("FG", "SocketManager");
        this.hookManager.registerClass("qV", "ItemManager");
        this.hookManager.registerClass("gW", "GameEngine");
        // this.hookManager.registerClass("LF", "MainPlayer");
        this.hookManager.registerClass("H", "GameCameraManager");
        // this.hookManager.registerClass("RX", "HealthBar")
        this.hookManager.registerClass("kF", "PF"); // Unkown Name (okay but niw this really needs a perma name - dpe)
        this.hookManager.registerClass("JG", "PrivateChatMessageList");
        this.hookManager.registerClass("MW", "LoginScreen");
        this.hookManager.registerClass('HR', 'HR');
        this.hookManager.registerClass('dH', 'ItemSpriteManager');
        this.hookManager.registerClass('DP', 'ItemDefMap');

        // Function Hook-ins
        this.hookManager.registerClassOverrideHook("LoginScreen", "_handleRegisterButtonClicked", this.loginHooks);
        this.hookManager.registerClassOverrideHook("LoginScreen", "_handleHomeButtonClicked", this.loginHooks);
        this.hookManager.registerClassHook("GameLoop", "_update");
        this.hookManager.registerClassHook("GameLoop", "_draw");
        this.hookManager.registerClassHook("PrivateChatMessageList", "addChatMessage");
        this.hookManager.registerClassHook("SocketManager", "_loggedIn");
        this.hookManager.registerClassHook("SocketManager", "_handleLoggedOut");
        this.hookManager.registerClassHook("SocketManager", "_handleEnteredIdleStateAction");
        this.hookManager.registerClassHook("SocketManager", "_handleTradeRequestedPacket");
        this.hookManager.registerClassHook("SocketManager", "_handleInvokedInventoryItemActionPacket");
        this.hookManager.registerClassHook("EntityManager", "addOtherPlayer");
        this.hookManager.registerClassHook("ItemManager", "invokeInventoryAction");

        // Needs Naming

        this.hookManager.registerClassHook("PF", "addItemToInventory");
        this.contextMenuManager.registerContextHook("nz", "_createInventoryItemContextMenuItems", this.contextMenuManager.inventoryContextHook);
        this.contextMenuManager.registerContextHook("nz", "_createGameWorldContextMenuItems", this.contextMenuManager.gameWorldContextHook);
        this.hookManager.registerStaticClassHook('BV', 'handleTargetAction');
        this.hookManager.registerStaticClassHook('BV', 'getActionsAndEntitiesAtMousePointer');
        this.hookManager.registerStaticClassHook('BV', 'getActionsAndEntitiesAtMousePointer', this.contextMenuManager.ActionSorting);

        // Lookup Table Mappings
        document.highlite.gameLookups["GameWorldActions"] = document.client.get("VA");
        document.highlite.gameLookups["InventoryActions"] = document.client.get("QA");
        document.highlite.gameLookups["Skills"] = document.client.get("bA");
        document.highlite.gameLookups["EquipmentTypes"] = document.client.get("oP");
        document.highlite.gameLookups["NpcDefs"] = document.client.get("uB");
    }

    async loginHooks(fnName: string, ...args: any[]) {
        if (fnName === "LoginScreen_handleRegisterButtonClicked") {
            window.open("https://highspell.com/register", "_blank");
        }
        if (fnName === "LoginScreen_handleHomeButtonClicked") {
            window.open("https://highspell.com/", "_blank");
        }
    }

    async start() {
        console.info("[Highlite] Core Started!");
        await this.databaseManager.initDB();
        if (!this.databaseManager.database) {
            console.error("[Highlite] Database not initialized!");
            return;
        } else {
            console.info("[Highlite] Database initialized!");
        }
        await this.notificationManager.askNotificationPermission();
        this.settingsManager.init();
        await this.settingsManager.registerPlugins();
        this.pluginManager.initAll();
        this.pluginManager.postInitAll();
        this.pluginManager.startAll();
    }

    stop() {
        console.info("[Highlite] Core Stopped!");
        this.pluginManager.stopAll();
    }

    reload() {
        console.info("[Highlite] Core Reloading");
        this.stop();
        this.start();
    }
}
