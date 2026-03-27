import { describe, it, expect } from 'vitest'
import {
    PALETTE_DRAG_TYPE,
    createPaletteDragData,
    parsePaletteDragData,
    createAddActionFromDrop,
    filterPaletteItems,
    getPaletteItemTestId,
    PaletteDragData,
} from '../../src/lib/automation/flows/util/piece-palette-utils'

describe('piece-palette-utils', () => {
    describe('PALETTE_DRAG_TYPE', () => {
        it('should equal the expected MIME-like type string', () => {
            expect(PALETTE_DRAG_TYPE).toBe('application/x-ap-palette-item')
        })
    })

    describe('getPaletteItemTestId', () => {
        it('should return data-testid string from piece name', () => {
            expect(getPaletteItemTestId('@activepieces/piece-gmail')).toBe(
                'palette-item-@activepieces/piece-gmail',
            )
        })

        it('should handle simple piece names', () => {
            expect(getPaletteItemTestId('code')).toBe('palette-item-code')
        })
    })

    describe('createPaletteDragData', () => {
        it('should produce a valid JSON string', () => {
            const result = createPaletteDragData(
                'PIECE',
                '@activepieces/piece-gmail',
                'Gmail',
                'https://cdn.example.com/gmail.png',
            )
            expect(() => JSON.parse(result)).not.toThrow()
        })

        it('should include all required fields with correct values', () => {
            const result = createPaletteDragData(
                'PIECE',
                '@activepieces/piece-gmail',
                'Gmail',
                'https://cdn.example.com/gmail.png',
            )
            const parsed = JSON.parse(result)
            expect(parsed.pieceType).toBe('PIECE')
            expect(parsed.pieceName).toBe('@activepieces/piece-gmail')
            expect(parsed.displayName).toBe('Gmail')
            expect(parsed.logoUrl).toBe('https://cdn.example.com/gmail.png')
        })

        it('should produce fields that are non-empty strings', () => {
            const result = createPaletteDragData(
                'CODE',
                'code',
                'Code',
                'https://cdn.example.com/code.svg',
            )
            const parsed = JSON.parse(result)
            expect(parsed.pieceType.length).toBeGreaterThan(0)
            expect(parsed.pieceName.length).toBeGreaterThan(0)
            expect(parsed.displayName.length).toBeGreaterThan(0)
            expect(parsed.logoUrl.length).toBeGreaterThan(0)
        })
    })

    describe('parsePaletteDragData', () => {
        it('should parse a valid JSON string back to PaletteDragData', () => {
            const json = JSON.stringify({
                pieceType: 'PIECE',
                pieceName: '@activepieces/piece-slack',
                displayName: 'Slack',
                logoUrl: 'https://cdn.example.com/slack.png',
            })
            const result = parsePaletteDragData(json)
            expect(result).not.toBeNull()
            expect(result!.pieceType).toBe('PIECE')
            expect(result!.pieceName).toBe('@activepieces/piece-slack')
            expect(result!.displayName).toBe('Slack')
            expect(result!.logoUrl).toBe('https://cdn.example.com/slack.png')
        })

        it('should return null for invalid JSON', () => {
            expect(parsePaletteDragData('not json')).toBeNull()
            expect(parsePaletteDragData('')).toBeNull()
            expect(parsePaletteDragData('{invalid')).toBeNull()
        })

        it('should return null for JSON missing required fields', () => {
            // Missing pieceName
            expect(
                parsePaletteDragData(
                    JSON.stringify({
                        pieceType: 'PIECE',
                        displayName: 'Gmail',
                        logoUrl: 'https://cdn.example.com/gmail.png',
                    }),
                ),
            ).toBeNull()

            // Missing pieceType
            expect(
                parsePaletteDragData(
                    JSON.stringify({
                        pieceName: 'gmail',
                        displayName: 'Gmail',
                        logoUrl: 'https://cdn.example.com/gmail.png',
                    }),
                ),
            ).toBeNull()

            // Missing displayName
            expect(
                parsePaletteDragData(
                    JSON.stringify({
                        pieceType: 'PIECE',
                        pieceName: 'gmail',
                        logoUrl: 'https://cdn.example.com/gmail.png',
                    }),
                ),
            ).toBeNull()

            // Missing logoUrl
            expect(
                parsePaletteDragData(
                    JSON.stringify({
                        pieceType: 'PIECE',
                        pieceName: 'gmail',
                        displayName: 'Gmail',
                    }),
                ),
            ).toBeNull()
        })

        it('should return null for empty string fields', () => {
            expect(
                parsePaletteDragData(
                    JSON.stringify({
                        pieceType: '',
                        pieceName: 'gmail',
                        displayName: 'Gmail',
                        logoUrl: 'https://cdn.example.com/gmail.png',
                    }),
                ),
            ).toBeNull()
        })

        it('should return null for non-string field types', () => {
            expect(
                parsePaletteDragData(
                    JSON.stringify({
                        pieceType: 123,
                        pieceName: 'gmail',
                        displayName: 'Gmail',
                        logoUrl: 'https://cdn.example.com/gmail.png',
                    }),
                ),
            ).toBeNull()
        })
    })

    describe('createAddActionFromDrop', () => {
        const baseDragData: PaletteDragData = {
            pieceType: 'PIECE',
            pieceName: '@activepieces/piece-gmail',
            displayName: 'Gmail',
            logoUrl: 'https://cdn.example.com/gmail.png',
        }

        it('should create ADD_ACTION for PIECE type', () => {
            const result = createAddActionFromDrop(baseDragData, 'trigger')
            expect(result.type).toBe('ADD_ACTION')
            expect(result.request.parentStep).toBe('trigger')
            expect(result.request.stepLocationRelativeToParent).toBe('AFTER')
            expect(result.request.action.type).toBe('PIECE')
            expect(
                (result.request.action.settings as Record<string, unknown>)
                    .pieceName,
            ).toBe('@activepieces/piece-gmail')
        })

        it('should create ADD_ACTION for CODE type', () => {
            const dragData: PaletteDragData = {
                ...baseDragData,
                pieceType: 'CODE',
                pieceName: 'code',
                displayName: 'Code',
            }
            const result = createAddActionFromDrop(dragData, 'step_1')
            expect(result.type).toBe('ADD_ACTION')
            expect(result.request.action.type).toBe('CODE')
            expect(
                (result.request.action.settings as Record<string, unknown>)
                    .sourceCode,
            ).toBeDefined()
        })

        it('should create ADD_ACTION for LOOP_ON_ITEMS type', () => {
            const dragData: PaletteDragData = {
                ...baseDragData,
                pieceType: 'LOOP_ON_ITEMS',
                pieceName: 'loop',
                displayName: 'Loop',
            }
            const result = createAddActionFromDrop(dragData, 'step_2')
            expect(result.type).toBe('ADD_ACTION')
            expect(result.request.action.type).toBe('LOOP_ON_ITEMS')
            expect(
                (result.request.action.settings as Record<string, unknown>)
                    .items,
            ).toBeDefined()
        })

        it('should create ADD_ACTION for ROUTER type', () => {
            const dragData: PaletteDragData = {
                ...baseDragData,
                pieceType: 'ROUTER',
                pieceName: 'router',
                displayName: 'Router',
            }
            const result = createAddActionFromDrop(dragData, 'step_3')
            expect(result.type).toBe('ADD_ACTION')
            expect(result.request.action.type).toBe('ROUTER')
            const settings = result.request.action.settings as Record<
                string,
                unknown
            >
            expect(settings.branches).toBeDefined()
            expect(Array.isArray(settings.branches)).toBe(true)
        })

        it('should set displayName from drag data', () => {
            const result = createAddActionFromDrop(baseDragData, 'trigger')
            expect(result.request.action.displayName).toBe('Gmail')
        })

        it('should set valid to false for new actions', () => {
            const result = createAddActionFromDrop(baseDragData, 'trigger')
            expect(result.request.action.valid).toBe(false)
        })
    })

    describe('filterPaletteItems', () => {
        const items: PaletteDragData[] = [
            {
                pieceType: 'PIECE',
                pieceName: '@activepieces/piece-gmail',
                displayName: 'Gmail',
                logoUrl: 'https://cdn.example.com/gmail.png',
            },
            {
                pieceType: 'PIECE',
                pieceName: '@activepieces/piece-slack',
                displayName: 'Slack',
                logoUrl: 'https://cdn.example.com/slack.png',
            },
            {
                pieceType: 'CODE',
                pieceName: 'code',
                displayName: 'Code',
                logoUrl: 'https://cdn.example.com/code.svg',
            },
        ]

        it('should return all items when query is empty', () => {
            const result = filterPaletteItems(items, '')
            expect(result).toHaveLength(3)
            expect(result).toEqual(items)
        })

        it('should filter by displayName case-insensitive', () => {
            const result = filterPaletteItems(items, 'gmail')
            expect(result).toHaveLength(1)
            expect(result[0].displayName).toBe('Gmail')
        })

        it('should handle uppercase queries', () => {
            const result = filterPaletteItems(items, 'SLACK')
            expect(result).toHaveLength(1)
            expect(result[0].displayName).toBe('Slack')
        })

        it('should return empty array when no matches', () => {
            const result = filterPaletteItems(items, 'nonexistent')
            expect(result).toHaveLength(0)
        })

        it('should match partial display names', () => {
            const result = filterPaletteItems(items, 'la')
            expect(result).toHaveLength(1)
            expect(result[0].displayName).toBe('Slack')
        })
    })

    describe('full pipeline round-trip', () => {
        it('should create -> parse -> createAddAction successfully', () => {
            // Step 1: Create drag data
            const dragDataStr = createPaletteDragData(
                'PIECE',
                '@activepieces/piece-gmail',
                'Gmail',
                'https://cdn.example.com/gmail.png',
            )

            // Step 2: Parse drag data (simulating DataTransfer.getData)
            const parsed = parsePaletteDragData(dragDataStr)
            expect(parsed).not.toBeNull()

            // Step 3: Create ADD_ACTION from parsed data
            const operation = createAddActionFromDrop(parsed!, 'trigger')
            expect(operation.type).toBe('ADD_ACTION')
            expect(operation.request.parentStep).toBe('trigger')
            expect(operation.request.action.type).toBe('PIECE')
            expect(operation.request.action.displayName).toBe('Gmail')
            expect(
                (operation.request.action.settings as Record<string, unknown>)
                    .pieceName,
            ).toBe('@activepieces/piece-gmail')
        })
    })
})
