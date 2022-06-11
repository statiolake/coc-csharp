/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CompletionItemProvider, TextDocument, Position, CompletionContext, CompletionList, CompletionItem, MarkupContent, TextEdit, Range, window, WorkspaceEdit, workspace, CompletionItemKind, MarkupKind } from "coc.nvim";
import AbstractProvider from "./abstractProvider";
import * as protocol from "../omnisharp/protocol";
import * as serverUtils from '../omnisharp/utils';
import { CancellationToken, CompletionTriggerKind as LspCompletionTriggerKind, InsertTextFormat } from "coc.nvim";
import { createRequest } from "../omnisharp/typeConversion";
import { LanguageMiddlewareFeature } from "../omnisharp/LanguageMiddlewareFeature";
import { OmniSharpServer } from "../omnisharp/server";
import { isVirtualCSharpDocument } from "./virtualDocumentTracker";

export const CompletionAfterInsertCommand = "csharp.completion.afterInsert";

export default class OmnisharpCompletionProvider extends AbstractProvider implements CompletionItemProvider {

    #lastCompletions?: Map<CompletionItem, protocol.OmnisharpCompletionItem>;

    constructor(server: OmniSharpServer, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
    }

    public async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionList> {
        let request = createRequest<protocol.CompletionRequest>(document, position);
        request.CompletionTrigger = (context.triggerKind + 1) as LspCompletionTriggerKind;
        request.TriggerCharacter = context.triggerCharacter;

        try {
            const response = await serverUtils.getCompletion(this._server, request, token);
            let mappedItems = response.Items.map(arg => this._convertToVscodeCompletionItem(arg));

            if (isVirtualCSharpDocument(document)) {
                // The `await` completion item is not compatible with all Razor scenarios.
                //
                // The `await` completion has been made smarter in that it will now update the containing method signature to include `async`, if it has not been specified.
                // This is problematic for Razor because it will now suggest making the code behind method that is "wrapping" the use of C# into an async method.
                // It makes this change by including additional text edits in the completion item.
                //
                // Example that generates an incompatible completion item:
                //
                // ```
                // @Da$$
                // ```
                //
                // Cases where you are in an async method there are no additional text edits and we can continue to offer the `await` keyword.
                //
                // Example that generates a compatible completion item:
                //
                // ```
                // @code {
                //   async Task GetNamesAsync()
                //   {
                //     var names = awa$$
                //   }
                // }
                // ```
                mappedItems = mappedItems.filter(item => item.label !== "await" || !item.additionalTextEdits);
            }

            let lastCompletions = new Map();

            for (let i = 0; i < mappedItems.length; i++) {
                lastCompletions.set(mappedItems[i], response.Items[i]);
            }

            this.#lastCompletions = lastCompletions;

            return { items: mappedItems, isIncomplete: false };
        }
        catch (error) {
            return;
        }
    }

    public async resolveCompletionItem(item: CompletionItem, token: CancellationToken): Promise<CompletionItem> {
        const lastCompletions = this.#lastCompletions;
        if (!lastCompletions) {
            return item;
        }

        const lspItem = lastCompletions.get(item);
        if (!lspItem) {
            return item;
        }

        const request: protocol.CompletionResolveRequest = { Item: lspItem };
        try {
            const response = await serverUtils.getCompletionResolve(this._server, request, token);
            return this._convertToVscodeCompletionItem(response.Item);
        }
        catch (error) {
            return;
        }
    }

    public async afterInsert(item: protocol.OmnisharpCompletionItem) {
        try {
            const uri = window.activeTextEditor.document.uri;
            const response = await serverUtils.getCompletionAfterInsert(this._server, { Item: item });

            if (!response.Changes || !response.Column || !response.Line) {
                return;
            }

            const changes = response.Changes.map(change => ({
                newText: change.NewText,
                range: {
                    start: {
                        line: change.StartLine,
                        character: change.StartColumn,
                    },
                    end: {
                        line: change.EndLine,
                        character: change.EndColumn,
                    },
                }
            }));
            let edit: WorkspaceEdit = { changes: {}  };
            edit.changes[uri] = changes;

            edit = await this._languageMiddlewareFeature.remap("remapWorkspaceEdit", edit, CancellationToken.None);

            const applied = await workspace.applyEdit(edit);
            if (!applied) {
                return;
            }
        }
        catch (error) {
            return;
        }
    }

    private _convertToVscodeCompletionItem(omnisharpCompletion: protocol.OmnisharpCompletionItem): CompletionItem {
        const docs: MarkupContent | undefined = omnisharpCompletion.Documentation ? { kind: MarkupKind.Markdown, value: omnisharpCompletion.Documentation } : undefined;

        const mapRange = function (edit: protocol.LinePositionSpanTextChange): Range {
            const newStart = { line: edit.StartLine, character: edit.StartColumn };
            const newEnd = { line: edit.EndLine, character: edit.EndColumn };
            return { start: newStart, end: newEnd };
        };

        const mapTextEdit = function (edit: protocol.LinePositionSpanTextChange): TextEdit {
            return { range: mapRange(edit), newText: edit.NewText };
        };

        const additionalTextEdits = omnisharpCompletion.AdditionalTextEdits?.map(mapTextEdit);

        const newText = omnisharpCompletion.TextEdit?.NewText ?? omnisharpCompletion.InsertText;
        const insertText = newText;
        const insertTextFormat = omnisharpCompletion.InsertTextFormat === InsertTextFormat.Snippet
            ? InsertTextFormat.Snippet
            : InsertTextFormat.PlainText;

        const insertRange = omnisharpCompletion.TextEdit ? mapRange(omnisharpCompletion.TextEdit) : undefined;

        return {
            label: omnisharpCompletion.Label,
            kind: (omnisharpCompletion.Kind - 1) as CompletionItemKind,
            documentation: docs,
            commitCharacters: omnisharpCompletion.CommitCharacters,
            preselect: omnisharpCompletion.Preselect,
            filterText: omnisharpCompletion.FilterText,
            insertTextFormat,
            textEdit: {
                range: insertRange,
                newText: insertText,
            },
            sortText: omnisharpCompletion.SortText,
            additionalTextEdits: additionalTextEdits,
            command: omnisharpCompletion.HasAfterInsertStep ? { command: CompletionAfterInsertCommand, title: "", arguments: [omnisharpCompletion] } : undefined
        };
    }
}
