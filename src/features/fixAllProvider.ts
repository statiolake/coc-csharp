/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as coc from 'coc.nvim';
import * as serverUtils from '../omnisharp/utils';
import * as protocol from '../omnisharp/protocol';
import { OmniSharpServer } from '../omnisharp/server';
import { FixAllScope, FixAllItem } from '../omnisharp/protocol';
import CompositeDisposable from '../CompositeDisposable';
import AbstractProvider from './abstractProvider';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';
import { buildEditForResponse } from '../omnisharp/fileOperationsResponseEditBuilder';
import { CancellationToken } from 'coc.nvim';

export class FixAllProvider extends AbstractProvider implements coc.CodeActionProvider {
    public static fixAllCodeActionKind =
      coc.CodeActionKind.SourceFixAll + 'csharp';

    public static metadata: coc.CodeActionProviderMetadata = {
      providedCodeActionKinds: [FixAllProvider.fixAllCodeActionKind]
    };

    public constructor(private server: OmniSharpServer, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
        let disposable = new CompositeDisposable();
        disposable.add(coc.commands.registerCommand('o.fixAll.solution', async () => this.fixAllMenu(server, protocol.FixAllScope.Solution)));
        disposable.add(coc.commands.registerCommand('o.fixAll.project', async () => this.fixAllMenu(server, protocol.FixAllScope.Project)));
        disposable.add(coc.commands.registerCommand('o.fixAll.document', async () => this.fixAllMenu(server, protocol.FixAllScope.Document)));
        this.addDisposables(disposable);
    }

    public async provideCodeActions(
        document: coc.TextDocument,
        _range: coc.Range,
        context: coc.CodeActionContext,
        _token: coc.CancellationToken,
    ): Promise<coc.CodeAction[]> {
        console.log(context);
        if (!context.only) {
            return [];
        }

        if (context.only.indexOf(FixAllProvider.fixAllCodeActionKind) >= 0) {
            await this.applyFixes(coc.Uri.parse(document.uri).fsPath, FixAllScope.Document, undefined);
        }

        return [];
    }

    private async fixAllMenu(server: OmniSharpServer, scope: protocol.FixAllScope): Promise<void> {
        let availableFixes = await serverUtils.getFixAll(server, { FileName: coc.Uri.parse(coc.window.activeTextEditor.document.uri).fsPath, Scope: scope });

        let targets = availableFixes.Items.map(x => `${x.Id}: ${x.Message}`);

        if (scope === protocol.FixAllScope.Document) {
            targets = ["Fix all issues", ...targets];
        }

        return coc.window.showQuickPick(targets, {
            canPickMany: false,
        }).then(async selectedAction => {
            let filter: FixAllItem[] = undefined;

            if (selectedAction === undefined) {
                return;
            }

            if (selectedAction !== "Fix all issues") {
                let actionTokens = selectedAction.split(":");
                filter = [{ Id: actionTokens[0], Message: actionTokens[1] }];
            }

            await this.applyFixes(coc.Uri.parse(coc.window.activeTextEditor.document.uri).fsPath, scope, filter);
        });
    }

    private async applyFixes(fileName: string, scope: FixAllScope, fixAllFilter: FixAllItem[]): Promise<boolean | string | {}> {
        let response = await serverUtils.runFixAll(this.server, {
            FileName: fileName,
            Scope: scope,
            FixAllFilter: fixAllFilter,
            WantsAllCodeActionOperations: true,
            WantsTextChanges: true,
            ApplyChanges: false
        });

        if (response) {
            return buildEditForResponse(response.Changes, this._languageMiddlewareFeature, CancellationToken.None);
        }
    }
}
