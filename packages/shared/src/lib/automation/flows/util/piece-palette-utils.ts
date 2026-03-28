import { FlowActionType } from '../actions/action'
import { StepLocationRelativeToParent } from '../operations'

/**
 * MIME-like type identifier for palette drag-and-drop data.
 * Used as the key in HTML5 DataTransfer.setData/getData.
 */
export const PALETTE_DRAG_TYPE = 'application/x-ap-palette-item'

/**
 * Data transferred during a palette item drag operation.
 * Serialized to JSON string for HTML5 DataTransfer.
 */
export type PaletteDragData = {
    /** FlowActionType value (e.g., 'PIECE', 'CODE', 'LOOP_ON_ITEMS', 'ROUTER') */
    pieceType: string
    /** Piece package name (e.g., '@activepieces/piece-gmail') or action type for primitives */
    pieceName: string
    /** Human-readable name (e.g., 'Gmail', 'Code', 'Loop') */
    displayName: string
    /** Piece icon URL */
    logoUrl: string
}

/**
 * Serialize palette drag data to a JSON string for HTML5 DataTransfer.
 *
 * @param pieceType - FlowActionType value
 * @param pieceName - piece package name
 * @param displayName - human-readable display name
 * @param logoUrl - piece icon URL
 * @returns JSON string containing all drag data fields
 */
export function createPaletteDragData(
    pieceType: string,
    pieceName: string,
    displayName: string,
    logoUrl: string,
): string {
    const data: PaletteDragData = {
        pieceType,
        pieceName,
        displayName,
        logoUrl,
    }
    return JSON.stringify(data)
}

/**
 * Parse a JSON string from HTML5 DataTransfer back to PaletteDragData.
 *
 * Returns null if:
 * - JSON parsing fails
 * - Required fields are missing or not non-empty strings
 *
 * @param data - JSON string from DataTransfer.getData()
 * @returns Parsed PaletteDragData or null if invalid
 */
export function parsePaletteDragData(data: string): PaletteDragData | null {
    try {
        const parsed = JSON.parse(data)
        if (
            typeof parsed !== 'object' ||
            parsed === null ||
            typeof parsed.pieceType !== 'string' ||
            typeof parsed.pieceName !== 'string' ||
            typeof parsed.displayName !== 'string' ||
            typeof parsed.logoUrl !== 'string' ||
            parsed.pieceType.length === 0 ||
            parsed.pieceName.length === 0 ||
            parsed.displayName.length === 0 ||
            parsed.logoUrl.length === 0
        ) {
            return null
        }
        return {
            pieceType: parsed.pieceType,
            pieceName: parsed.pieceName,
            displayName: parsed.displayName,
            logoUrl: parsed.logoUrl,
        }
    }
    catch {
        return null
    }
}

/**
 * Create a FlowOperationRequest for ADD_ACTION from dropped palette data.
 *
 * Generates the appropriate action schema based on pieceType:
 * - PIECE: includes pieceName and pieceVersion
 * - CODE: empty code action with default source
 * - LOOP_ON_ITEMS: empty loop action
 * - ROUTER: empty router action with one default branch
 *
 * @param dragData - Parsed palette drag data
 * @param parentStep - The step name to attach the new action after
 * @returns Object with type=ADD_ACTION and request containing action details
 */
export function createAddActionFromDrop(
    dragData: PaletteDragData,
    parentStep: string,
): {
    type: 'ADD_ACTION'
    request: {
        parentStep: string
        stepLocationRelativeToParent: StepLocationRelativeToParent
        action: Record<string, unknown>
    }
} {
    const baseName = `step_${Date.now()}`
    const baseAction = {
        name: baseName,
        valid: false,
        displayName: dragData.displayName,
    }

    let action: Record<string, unknown>

    switch (dragData.pieceType) {
        case FlowActionType.CODE:
            action = {
                ...baseAction,
                type: FlowActionType.CODE,
                settings: {
                    sourceCode: {
                        code: '',
                        packageJson: '{}',
                    },
                    input: {},
                    inputUiInfo: {},
                    errorHandlingOptions: {
                        continueOnFailure: { value: false },
                        retryOnFailure: { value: false },
                    },
                },
            }
            break
        case FlowActionType.LOOP_ON_ITEMS:
            action = {
                ...baseAction,
                type: FlowActionType.LOOP_ON_ITEMS,
                settings: {
                    items: '',
                    inputUiInfo: {},
                },
            }
            break
        case FlowActionType.ROUTER:
            action = {
                ...baseAction,
                type: FlowActionType.ROUTER,
                settings: {
                    branches: [
                        {
                            branchName: 'Branch 1',
                            branchType: 'CONDITION',
                            conditions: [[]],
                        },
                        {
                            branchName: 'Fallback',
                            branchType: 'FALLBACK',
                        },
                    ],
                    executionType: 'EXECUTE_FIRST_MATCH',
                    inputUiInfo: {},
                },
            }
            break
        case FlowActionType.PIECE:
        default:
            action = {
                ...baseAction,
                type: FlowActionType.PIECE,
                settings: {
                    pieceName: dragData.pieceName,
                    pieceVersion: '~0.0.0',
                    pieceType: 'OFFICIAL',
                    packageType: 'REGISTRY',
                    input: {},
                    inputUiInfo: {},
                    errorHandlingOptions: {
                        continueOnFailure: { value: false },
                        retryOnFailure: { value: false },
                    },
                },
            }
            break
    }

    return {
        type: 'ADD_ACTION',
        request: {
            parentStep,
            stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
            action,
        },
    }
}

/**
 * Filter palette items by display name substring match.
 *
 * @param items - Array of PaletteDragData to filter
 * @param query - Search query string
 * @returns Filtered array. Returns all items when query is empty.
 */
export function filterPaletteItems(
    items: PaletteDragData[],
    query: string,
): PaletteDragData[] {
    if (query.length === 0) {
        return items
    }
    const lowerQuery = query.toLowerCase()
    return items.filter((item) =>
        item.displayName.toLowerCase().includes(lowerQuery),
    )
}

/**
 * Generate a data-testid attribute value for a palette item.
 *
 * @param pieceName - Piece package name
 * @returns data-testid string in format `palette-item-{pieceName}`
 */
export function getPaletteItemTestId(pieceName: string): string {
    return `palette-item-${pieceName}`
}

/**
 * Описание входного элемента для маппинга в PaletteDragData.
 * Совместимо с PieceMetadataModelSummary из pieces-framework.
 */
export type PieceSummaryForPalette = {
    /** Имя пакета piece (e.g., '@activepieces/piece-gmail') */
    name: string
    /** Отображаемое имя (e.g., 'Gmail') */
    displayName: string
    /** URL иконки */
    logoUrl: string
    /** Тип piece (e.g., 'OFFICIAL', 'CUSTOM') — не используется для pieceType в PaletteDragData */
    pieceType: string
}

/**
 * Встроенные (built-in) элементы палитры, которые не являются pieces,
 * но доступны как действия на canvas (Code, Loop, Branch/Router).
 */
export const BUILT_IN_PALETTE_ITEMS: PaletteDragData[] = [
    {
        pieceType: FlowActionType.CODE,
        pieceName: 'code',
        displayName: 'Code',
        logoUrl: '/assets/img/custom/piece/code.svg',
    },
    {
        pieceType: FlowActionType.LOOP_ON_ITEMS,
        pieceName: 'loop',
        displayName: 'Loop',
        logoUrl: '/assets/img/custom/piece/loop.svg',
    },
    {
        pieceType: FlowActionType.ROUTER,
        pieceName: 'router',
        displayName: 'Branch',
        logoUrl: '/assets/img/custom/piece/branch.svg',
    },
]

/**
 * Маппинг массива PieceMetadataModelSummary (или любого объекта с полями name, displayName, logoUrl)
 * в массив PaletteDragData для отображения в палитре.
 *
 * Добавляет встроенные типы (Code, Loop, Branch) в начало списка.
 *
 * P2-B01: Подключение PiecePalette к реальным данным pieces.
 *
 * @param pieces - Массив piece summaries из API
 * @returns Массив PaletteDragData для PiecePalette компонента
 */
export function mapPiecesToPaletteItems(
    pieces: PieceSummaryForPalette[],
): PaletteDragData[] {
    const pieceItems: PaletteDragData[] = pieces.map((piece) => ({
        pieceType: FlowActionType.PIECE,
        pieceName: piece.name,
        displayName: piece.displayName,
        logoUrl: piece.logoUrl,
    }))

    return [...BUILT_IN_PALETTE_ITEMS, ...pieceItems]
}
