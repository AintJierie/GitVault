import { App, Modal, Notice, Setting, TextAreaComponent } from 'obsidian';
import { GitHubAPI } from '../github/api';

export class CreateIssueModal extends Modal {
    private title: string = '';
    private body: string = '';

    constructor(
        app: App,
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: `New Issue: ${this.repoInfo.repo}` });

        new Setting(contentEl)
            .setName('Title')
            .addText(text => text
                .setPlaceholder('Issue title')
                .onChange(value => {
                    this.title = value;
                }));

        new Setting(contentEl)
            .setName('Body')
            .addTextArea(text => text
                .setPlaceholder('Describe the issue (Markdown supported)')
                .onChange(value => {
                    this.body = value;
                }));

        // CSS hack for textarea height
        const textareas = contentEl.querySelectorAll('textarea');
        textareas.forEach(t => t.style.height = '150px');

        const btnContainer = contentEl.createDiv();
        btnContainer.style.display = 'flex';
        btnContainer.style.justifyContent = 'flex-end';
        btnContainer.style.gap = '10px';
        btnContainer.style.marginTop = '20px';

        const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();

        const submitBtn = btnContainer.createEl('button', { text: 'Submit Issue', cls: 'mod-cta' });
        submitBtn.onclick = async () => {
            if (!this.title) {
                new Notice('Title is required');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.setText('Submitting...');

            try {
                const issue = await this.githubAPI.createIssue(
                    this.repoInfo.owner,
                    this.repoInfo.repo,
                    this.title,
                    this.body
                );
                new Notice(`Issue #${issue.number} created!`);
                this.close();
                window.open(issue.html_url); // Optional: verify
            } catch (e: any) {
                new Notice(`Error: ${e.message}`);
                submitBtn.disabled = false;
                submitBtn.setText('Submit Issue');
            }
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
