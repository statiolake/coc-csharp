/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as protocol from './protocol';
import * as coc from 'coc.nvim';

export function toLocation(location: protocol.ResourceLocation | protocol.QuickFix): coc.Location {
    const fileName = coc.Uri.file(location.FileName);
    return toLocationFromUri(fileName, location);
}

export function toLocationFromUri(uri: coc.Uri, location: protocol.ResourceLocation | protocol.QuickFix): coc.Location {
    const position = { line: location.Line, character: location.Column };

    const endLine = (<protocol.QuickFix>location).EndLine;
    const endColumn = (<protocol.QuickFix>location).EndColumn;

    if (endLine !== undefined && endColumn !== undefined) {
        const endPosition = { line: endLine, character: endColumn };
        return {
            uri: uri.toString(),
            range: { start: position, end: endPosition },
        };
    }

    return {
        uri: uri.toString(),
        range: { start: position, end: position },
    };
}

export function toVscodeLocation(omnisharpLocation: protocol.V2.Location): coc.Location {
    return {
        uri: coc.Uri.file(omnisharpLocation.FileName).toString(),
        range: toRange3(omnisharpLocation.Range)
    };
}

export function toRange(rangeLike: { Line: number; Column: number; EndLine: number; EndColumn: number; }): coc.Range {
    let { Line, Column, EndLine, EndColumn } = rangeLike;
    return toVSCodeRange(Line, Column, EndLine, EndColumn);
}

export function toRange2(rangeLike: { StartLine: number; StartColumn: number; EndLine: number; EndColumn: number; }): coc.Range {
    let { StartLine, StartColumn, EndLine, EndColumn } = rangeLike;
    return toVSCodeRange(StartLine, StartColumn, EndLine, EndColumn);
}

export function toRange3(range: protocol.V2.Range): coc.Range {
    return toVSCodeRange(range.Start.Line, range.Start.Column, range.End.Line, range.End.Column);
}

export function toVSCodeRange(StartLine: number, StartColumn: number, EndLine: number, EndColumn: number): coc.Range {
    return {
        start: {
            line: StartLine,
            character: StartColumn,
        },
        end: {
            line: EndLine,
            character: EndColumn,
        },
    };
}

export function fromVSCodeRange(range: coc.Range): protocol.V2.Range {
    return {
        Start: fromVSCodePosition(range.start),
        End: fromVSCodePosition(range.end)
    };
}

export function fromVSCodePosition(position: coc.Position): protocol.V2.Point {
    return { Line: position.line, Column: position.character };
}

export function toVSCodePosition(point: protocol.V2.Point): coc.Position {
    return { line: point.Line, character: point.Column };
}

export function toVSCodeTextEdit(textChange: protocol.LinePositionSpanTextChange): coc.TextEdit {
    return coc.TextEdit.replace(toRange2(textChange), textChange.NewText);
}

export function createRequest<T extends protocol.Request>(document: coc.TextDocument, where: coc.Position, includeBuffer: boolean = false): T {
    // for metadata sources, we need to remove the [metadata] from the filename, and prepend the $metadata$ authority
    // this is expected by the Omnisharp server to support metadata-to-metadata navigation
    const uri = coc.Uri.parse(document.uri);
    const fileName = uri.scheme === "omnisharp-metadata" ?
        `${uri.authority}${uri.fsPath.replace("[metadata] ", "")}` :
        uri.fsPath;

    const request: protocol.Request = {
        FileName: fileName,
        Buffer: includeBuffer ? document.getText() : undefined,
        Line: where.line,
        Column: where.character,
    };

    return <T>request;
}
