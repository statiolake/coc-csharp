/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as serverUtils from '../omnisharp/utils';
import * as coc from 'coc.nvim';
import AbstractProvider from './abstractProvider';
import { OmniSharpServer } from '../omnisharp/server';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';
import CompositeDisposable from '../CompositeDisposable';
import { InlayHint, InlayHintRequest, InlayHintResolve as InlayHintResolveRequest, LinePositionSpanTextChange } from '../omnisharp/protocol';
import { fromVSCodeRange, toVSCodePosition, toVSCodeTextEdit } from '../omnisharp/typeConversion';
import { isVirtualCSharpDocument } from './virtualDocumentTracker';

export default class CSharpInlayHintProvider extends AbstractProvider implements coc.InlayHintsProvider {
    private readonly _onDidChangeInlayHints = new coc.Emitter<void>();
    public readonly onDidChangeInlayHints = this._onDidChangeInlayHints.event;

    private readonly _hintsMap = new Map<coc.InlayHint, InlayHint>();

    constructor(server: OmniSharpServer, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
        this.addDisposables(new CompositeDisposable(
            this._onDidChangeInlayHints,
            coc.workspace.onDidChangeTextDocument(e => {
                if (coc.workspace.getDocument(e.textDocument.uri).languageId === 'csharp') {
                    this._onDidChangeInlayHints.fire();
                }
            })));
    }

    async provideInlayHints(document: coc.TextDocument, range: coc.Range, token: coc.CancellationToken): Promise<coc.InlayHint[]> {
        // Exclude documents from other schemes, such as those in the diff view.
        if (coc.Uri.parse(document.uri).scheme !== "file") {
            return [];
        }

        if (isVirtualCSharpDocument(document)) {
            return [];
        }

        const request: InlayHintRequest = {
            Location: {
                FileName: coc.Uri.parse(document.uri).fsPath,
                Range: fromVSCodeRange(range)
            }
        };

        try {
            const hints = await serverUtils.getInlayHints(this._server, request, token);

            return hints.InlayHints.map((inlayHint): coc.InlayHint => {
                const mappedHint = this.toVSCodeHint(inlayHint);
                this._hintsMap.set(mappedHint, inlayHint);
                return mappedHint;
            });
        } catch (error) {
            return Promise.reject(`Problem invoking 'GetInlayHints' on OmniSharpServer: ${error}`);
        }
    }

    async resolveInlayHint?(hint: coc.InlayHint, token: coc.CancellationToken): Promise<coc.InlayHint> {
        if (!this._hintsMap.has(hint)) {
            return Promise.reject(`Outdated inlay hint was requested to be resolved, aborting.`);
        }

        const request: InlayHintResolveRequest = { Hint: this._hintsMap.get(hint) };

        try {
            const result = await serverUtils.resolveInlayHints(this._server, request, token);
            return this.toVSCodeHint(result);
        } catch (error) {
            return Promise.reject(`Problem invoking 'ResolveInlayHints' on OmniSharpServer: ${error}`);
        }
    }

    private toVSCodeHint(inlayHint: InlayHint): coc.InlayHint {
        return {
            label: inlayHint.Label,
            position: toVSCodePosition(inlayHint.Position),
            tooltip: {
                kind: coc.MarkupKind.Markdown,
                value: inlayHint.Tooltip ?? ""
            }
        };

        function toVSCodeTextEdits(textEdits: LinePositionSpanTextChange[]): coc.TextEdit[] {
            return textEdits ? textEdits.map(toVSCodeTextEdit) : undefined;
        }
    }
}
