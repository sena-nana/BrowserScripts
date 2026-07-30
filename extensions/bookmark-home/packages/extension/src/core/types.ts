export type ThemePreference = "system" | "light" | "dark";
export type SearchProviderId = "google" | "bing" | "baidu" | "custom";
export type SidebarDensity = "compact" | "standard" | "relaxed";

export interface SettingsV4 {
  version: 4;
  appearance: {
    theme: ThemePreference;
    sidebarWidth: number;
    sidebarCollapsed: boolean;
    sidebarDensity: SidebarDensity;
    panelTransparency: number;
    backdropBlur: number;
  };
  search: {
    provider: SearchProviderId;
    customName: string;
    customSearchUrl: string;
    historySuggestions: boolean;
    onlineSuggestions: boolean;
  };
}

export interface LocalUiStateV1 {
  version: 1;
  expandedFolderIds: string[];
}

export interface HomeBackgroundV1 {
  version: 1;
  dataUrl: string;
  updatedAt: number;
}

export interface BookmarkNode {
  id: string;
  parentId?: string;
  index?: number;
  title: string;
  url?: string;
  dateAdded?: number;
  dateLastUsed?: number;
  folderType?: "bookmarks-bar" | "other" | "mobile" | "managed";
  unmodifiable?: "managed";
  trash?: boolean;
}

export interface BookmarkCreateInput {
  parentId: string;
  title: string;
  url?: string;
  index?: number;
}

export interface BookmarkMoveTarget {
  parentId: string;
  index?: number;
}

export type BookmarkEvent =
  | { type: "created"; node: BookmarkNode }
  | { type: "changed"; id: string; title: string; url?: string }
  | {
      type: "moved";
      id: string;
      parentId: string;
      index: number;
      oldParentId: string;
      oldIndex: number;
    }
  | { type: "removed"; id: string; parentId: string; index: number }
  | { type: "reordered"; parentId: string; childIds: string[] }
  | { type: "import-began" }
  | { type: "import-ended" };

export type BookmarkEventListener = (event: BookmarkEvent) => void;

export interface BookmarkRepository {
  getRootChildren(): Promise<BookmarkNode[]>;
  getAll(): Promise<BookmarkNode[]>;
  getChildren(parentId: string): Promise<BookmarkNode[]>;
  getNode(id: string): Promise<BookmarkNode | null>;
  getSubTree(id: string): Promise<BookmarkNode[]>;
  search(query: string): Promise<BookmarkNode[]>;
  create(input: BookmarkCreateInput): Promise<BookmarkNode>;
  update(
    id: string,
    changes: { title?: string; url?: string },
  ): Promise<BookmarkNode>;
  move(id: string, target: BookmarkMoveTarget): Promise<BookmarkNode>;
  remove(id: string, recursive: boolean): Promise<void>;
  subscribe(listener: BookmarkEventListener): () => void;
}

export interface TreeRow {
  node: BookmarkNode;
  depth: number;
  expanded: boolean;
  loading: boolean;
}

export type SuggestionSource = "bookmark" | "history" | "online";

export interface Suggestion {
  id: string;
  source: SuggestionSource;
  title: string;
  url?: string;
  query?: string;
  score: number;
}
