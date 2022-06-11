/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import * as coc from 'coc.nvim';

import Structure = protocol.V2.Structure;
import SymbolKinds = protocol.V2.SymbolKinds;
import SymbolRangeNames = protocol.V2.SymbolRangeNames;
import { toRange3 } from '../omnisharp/typeConversion';

export default class OmnisharpDocumentSymbolProvider extends AbstractSupport implements coc.DocumentSymbolProvider {

    async provideDocumentSymbols(document: coc.TextDocument, token: coc.CancellationToken): Promise<coc.DocumentSymbol[]> {
        try {
            const response = await serverUtils.codeStructure(this._server, { FileName: coc.Uri.parse(document.uri).fsPath }, token);

            if (response && response.Elements) {
                return createSymbols(response.Elements);
            }

            return [];
        }
        catch (error) {
            return [];
        }
    }
}

function createSymbols(elements: Structure.CodeElement[]): coc.DocumentSymbol[] {
    let results: coc.DocumentSymbol[] = [];

    elements.forEach(element => {
        let symbol = createSymbolForElement(element);
        if (element.Children) {
            symbol.children = createSymbols(element.Children);
        }

        results.push(symbol);
    });

    return results;
}

function createSymbolForElement(element: Structure.CodeElement): coc.DocumentSymbol {
    const fullRange = element.Ranges[SymbolRangeNames.Full];
    const nameRange = element.Ranges[SymbolRangeNames.Name];

    return {
        name: element.DisplayName,
        detail: "",
        kind: toSymbolKind(element.Kind),
        range: toRange3(fullRange),
        selectionRange: toRange3(nameRange),
    };
}

const kinds: { [kind: string]: coc.SymbolKind; } = {};

kinds[SymbolKinds.Class] = coc.SymbolKind.Class;
kinds[SymbolKinds.Delegate] = coc.SymbolKind.Class;
kinds[SymbolKinds.Enum] = coc.SymbolKind.Enum;
kinds[SymbolKinds.Interface] = coc.SymbolKind.Interface;
kinds[SymbolKinds.Struct] = coc.SymbolKind.Struct;

kinds[SymbolKinds.Constant] = coc.SymbolKind.Constant;
kinds[SymbolKinds.Destructor] = coc.SymbolKind.Method;
kinds[SymbolKinds.EnumMember] = coc.SymbolKind.EnumMember;
kinds[SymbolKinds.Event] = coc.SymbolKind.Event;
kinds[SymbolKinds.Field] = coc.SymbolKind.Field;
kinds[SymbolKinds.Indexer] = coc.SymbolKind.Property;
kinds[SymbolKinds.Method] = coc.SymbolKind.Method;
kinds[SymbolKinds.Operator] = coc.SymbolKind.Operator;
kinds[SymbolKinds.Property] = coc.SymbolKind.Property;

kinds[SymbolKinds.Namespace] = coc.SymbolKind.Namespace;
kinds[SymbolKinds.Unknown] = coc.SymbolKind.Class;

function toSymbolKind(kind: string): coc.SymbolKind {
    // Note: 'constructor' is a special property name for JavaScript objects.
    // So, we need to handle it specifically.
    if (kind === 'constructor') {
        return coc.SymbolKind.Constructor;
    }

    return kinds[kind];
}
