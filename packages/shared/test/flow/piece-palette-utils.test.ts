import { describe, it, expect } from 'vitest'
import {
    PALETTE_DRAG_TYPE,
    createPaletteDragData,
    parsePaletteDragData,
    createAddActionFromDrop,
    createGraphAddNodeFromDrop,
    filterPaletteItems,
    getPaletteItemTestId,
    mapPiecesToPaletteItems,
    BUILT_IN_PALETTE_ITEMS,
    PaletteDragData,
    PieceSummaryForPalette,
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

    describe('BUILT_IN_PALETTE_ITEMS', () => {
        it('should contain exactly 3 built-in items (Code, Loop, Branch)', () => {
            expect(BUILT_IN_PALETTE_ITEMS).toHaveLength(3)
        })

        it('should have Code item with pieceType CODE', () => {
            const codeItem = BUILT_IN_PALETTE_ITEMS.find(
                (item) => item.pieceName === 'code',
            )
            expect(codeItem).toBeDefined()
            expect(codeItem!.pieceType).toBe('CODE')
            expect(codeItem!.displayName).toBe('Code')
            expect(codeItem!.logoUrl).toContain('code')
        })

        it('should have Loop item with pieceType LOOP_ON_ITEMS', () => {
            const loopItem = BUILT_IN_PALETTE_ITEMS.find(
                (item) => item.pieceName === 'loop',
            )
            expect(loopItem).toBeDefined()
            expect(loopItem!.pieceType).toBe('LOOP_ON_ITEMS')
            expect(loopItem!.displayName).toBe('Loop')
        })

        it('should have Branch item with pieceType ROUTER', () => {
            const branchItem = BUILT_IN_PALETTE_ITEMS.find(
                (item) => item.pieceName === 'router',
            )
            expect(branchItem).toBeDefined()
            expect(branchItem!.pieceType).toBe('ROUTER')
            expect(branchItem!.displayName).toBe('Branch')
        })

        it('should have non-empty logoUrl for all items', () => {
            for (const item of BUILT_IN_PALETTE_ITEMS) {
                expect(item.logoUrl.length).toBeGreaterThan(0)
            }
        })
    })

    describe('createGraphAddNodeFromDrop', () => {
        const baseDragData: PaletteDragData = {
            pieceType: 'PIECE',
            pieceName: '@activepieces/piece-gmail',
            displayName: 'Gmail',
            logoUrl: 'https://cdn.example.com/gmail.png',
        }
        const dropPosition = { x: 250, y: 400 }

        it('should create GRAPH_ADD_NODE for PIECE type', () => {
            const result = createGraphAddNodeFromDrop(baseDragData, dropPosition)
            expect(result.type).toBe('GRAPH_ADD_NODE')
            expect(result.request.node.type).toBe('action')
            expect(result.request.node.actionType).toBe('PIECE')
            expect(result.request.node.displayName).toBe('Gmail')
            expect(result.request.node.valid).toBe(false)
            expect(result.request.node.settings.pieceName).toBe('@activepieces/piece-gmail')
        })

        it('should set position from drop coordinates', () => {
            const result = createGraphAddNodeFromDrop(baseDragData, { x: 123, y: 456 })
            expect(result.request.node.position.x).toBe(123)
            expect(result.request.node.position.y).toBe(456)
        })

        it('should create GRAPH_ADD_NODE for CODE type with node type action', () => {
            const dragData: PaletteDragData = {
                ...baseDragData,
                pieceType: 'CODE',
                pieceName: 'code',
                displayName: 'Code',
            }
            const result = createGraphAddNodeFromDrop(dragData, dropPosition)
            expect(result.type).toBe('GRAPH_ADD_NODE')
            expect(result.request.node.type).toBe('action')
            expect(result.request.node.actionType).toBe('CODE')
            expect(result.request.node.settings.sourceCode).toBeDefined()
        })

        it('should create GRAPH_ADD_NODE for LOOP_ON_ITEMS type with node type loop', () => {
            const dragData: PaletteDragData = {
                ...baseDragData,
                pieceType: 'LOOP_ON_ITEMS',
                pieceName: 'loop',
                displayName: 'Loop',
            }
            const result = createGraphAddNodeFromDrop(dragData, dropPosition)
            expect(result.type).toBe('GRAPH_ADD_NODE')
            expect(result.request.node.type).toBe('loop')
            expect(result.request.node.actionType).toBe('LOOP_ON_ITEMS')
            expect(result.request.node.settings.items).toBeDefined()
        })

        it('should create GRAPH_ADD_NODE for ROUTER type with node type router', () => {
            const dragData: PaletteDragData = {
                ...baseDragData,
                pieceType: 'ROUTER',
                pieceName: 'router',
                displayName: 'Branch',
            }
            const result = createGraphAddNodeFromDrop(dragData, dropPosition)
            expect(result.type).toBe('GRAPH_ADD_NODE')
            expect(result.request.node.type).toBe('router')
            expect(result.request.node.actionType).toBe('ROUTER')
            const settings = result.request.node.settings
            expect(settings.branches).toBeDefined()
            expect(Array.isArray(settings.branches)).toBe(true)
        })

        it('should generate unique node id starting with step_', () => {
            const result = createGraphAddNodeFromDrop(baseDragData, dropPosition)
            expect(result.request.node.id).toMatch(/^step_\d+$/)
        })

        it('should generate different ids for consecutive calls', () => {
            const result1 = createGraphAddNodeFromDrop(baseDragData, dropPosition)
            // Small delay to ensure Date.now() differs
            const result2 = createGraphAddNodeFromDrop(baseDragData, dropPosition)
            // IDs may or may not differ depending on timing, but they should be valid
            expect(result1.request.node.id).toMatch(/^step_\d+$/)
            expect(result2.request.node.id).toMatch(/^step_\d+$/)
        })

        it('should set displayName from drag data', () => {
            const result = createGraphAddNodeFromDrop(baseDragData, dropPosition)
            expect(result.request.node.displayName).toBe('Gmail')
        })

        it('should set valid to false for new nodes', () => {
            const result = createGraphAddNodeFromDrop(baseDragData, dropPosition)
            expect(result.request.node.valid).toBe(false)
        })

        it('should produce node with PIECE settings containing pieceVersion', () => {
            const result = createGraphAddNodeFromDrop(baseDragData, dropPosition)
            expect(result.request.node.settings.pieceVersion).toBe('~0.0.0')
        })

        it('should produce node with PIECE settings containing packageType', () => {
            const result = createGraphAddNodeFromDrop(baseDragData, dropPosition)
            expect(result.request.node.settings.packageType).toBe('REGISTRY')
        })

        it('should handle negative coordinates', () => {
            const result = createGraphAddNodeFromDrop(baseDragData, { x: -100, y: -200 })
            expect(result.request.node.position.x).toBe(-100)
            expect(result.request.node.position.y).toBe(-200)
        })

        it('should handle zero coordinates', () => {
            const result = createGraphAddNodeFromDrop(baseDragData, { x: 0, y: 0 })
            expect(result.request.node.position.x).toBe(0)
            expect(result.request.node.position.y).toBe(0)
        })

        it('full pipeline: create drag data -> parse -> createGraphAddNodeFromDrop', () => {
            const dragDataStr = createPaletteDragData(
                'PIECE',
                '@activepieces/piece-slack',
                'Slack',
                'https://cdn.example.com/slack.png',
            )
            const parsed = parsePaletteDragData(dragDataStr)
            expect(parsed).not.toBeNull()

            const operation = createGraphAddNodeFromDrop(parsed!, { x: 300, y: 500 })
            expect(operation.type).toBe('GRAPH_ADD_NODE')
            expect(operation.request.node.displayName).toBe('Slack')
            expect(operation.request.node.position.x).toBe(300)
            expect(operation.request.node.position.y).toBe(500)
            expect(operation.request.node.settings.pieceName).toBe('@activepieces/piece-slack')
        })
    })

    describe('mapPiecesToPaletteItems', () => {
        const mockPieces: PieceSummaryForPalette[] = [
            {
                name: '@activepieces/piece-gmail',
                displayName: 'Gmail',
                logoUrl: 'https://cdn.example.com/gmail.png',
                pieceType: 'OFFICIAL',
            },
            {
                name: '@activepieces/piece-slack',
                displayName: 'Slack',
                logoUrl: 'https://cdn.example.com/slack.png',
                pieceType: 'OFFICIAL',
            },
        ]

        it('should return built-in items + mapped pieces', () => {
            const result = mapPiecesToPaletteItems(mockPieces)
            // 3 built-in + 2 pieces = 5
            expect(result).toHaveLength(5)
        })

        it('should place built-in items first', () => {
            const result = mapPiecesToPaletteItems(mockPieces)
            expect(result[0].pieceName).toBe('code')
            expect(result[1].pieceName).toBe('loop')
            expect(result[2].pieceName).toBe('router')
        })

        it('should map piece name to pieceName field', () => {
            const result = mapPiecesToPaletteItems(mockPieces)
            const gmailItem = result.find(
                (item) => item.pieceName === '@activepieces/piece-gmail',
            )
            expect(gmailItem).toBeDefined()
            expect(gmailItem!.displayName).toBe('Gmail')
            expect(gmailItem!.logoUrl).toBe('https://cdn.example.com/gmail.png')
        })

        it('should set pieceType to PIECE for all mapped pieces', () => {
            const result = mapPiecesToPaletteItems(mockPieces)
            // Skip first 3 (built-in)
            const pieceItems = result.slice(3)
            for (const item of pieceItems) {
                expect(item.pieceType).toBe('PIECE')
            }
        })

        it('should return only built-in items for empty input', () => {
            const result = mapPiecesToPaletteItems([])
            expect(result).toHaveLength(3)
            expect(result[0].pieceName).toBe('code')
            expect(result[1].pieceName).toBe('loop')
            expect(result[2].pieceName).toBe('router')
        })

        it('should handle single piece input', () => {
            const single: PieceSummaryForPalette[] = [
                {
                    name: '@activepieces/piece-http',
                    displayName: 'HTTP',
                    logoUrl: 'https://cdn.example.com/http.png',
                    pieceType: 'OFFICIAL',
                },
            ]
            const result = mapPiecesToPaletteItems(single)
            expect(result).toHaveLength(4)
            expect(result[3].pieceName).toBe('@activepieces/piece-http')
            expect(result[3].pieceType).toBe('PIECE')
        })

        it('should produce valid PaletteDragData for all items', () => {
            const result = mapPiecesToPaletteItems(mockPieces)
            for (const item of result) {
                expect(typeof item.pieceType).toBe('string')
                expect(typeof item.pieceName).toBe('string')
                expect(typeof item.displayName).toBe('string')
                expect(typeof item.logoUrl).toBe('string')
                expect(item.pieceType.length).toBeGreaterThan(0)
                expect(item.pieceName.length).toBeGreaterThan(0)
                expect(item.displayName.length).toBeGreaterThan(0)
                expect(item.logoUrl.length).toBeGreaterThan(0)
            }
        })

        it('should ignore source pieceType field (OFFICIAL/CUSTOM) and use PIECE', () => {
            const customPiece: PieceSummaryForPalette[] = [
                {
                    name: '@custom/my-piece',
                    displayName: 'My Custom Piece',
                    logoUrl: 'https://cdn.example.com/custom.png',
                    pieceType: 'CUSTOM',
                },
            ]
            const result = mapPiecesToPaletteItems(customPiece)
            const customItem = result.find(
                (item) => item.pieceName === '@custom/my-piece',
            )
            expect(customItem).toBeDefined()
            // pieceType в PaletteDragData — это FlowActionType.PIECE, не PieceType.CUSTOM
            expect(customItem!.pieceType).toBe('PIECE')
        })
    })
})
