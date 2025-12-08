import { App, Modal, Notice, setIcon } from 'obsidian';
import { GitHubAPI } from '../github/api';

export class CreateIssueModal extends Modal {
    private title = '';
    private body = '';

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
        contentEl.addClass('ps-content-no-padding');
        contentEl.addClass('ps-modal-small');

        // Header
        const header = contentEl.createDiv({ cls: 'ps-modal-header' });
        const titleRow = header.createDiv({ cls: 'ps-modal-title-row' });

        const iconEl = titleRow.createSpan({ cls: 'ps-icon-accent ps-icon-green' });
        setIcon(iconEl, 'plus-circle');

        titleRow.createEl('h2', { text: 'Create new issue', cls: 'ps-modal-title' });

        header.createDiv({ text: `${this.repoInfo.owner}/${this.repoInfo.repo}`, cls: 'ps-modal-subtitle' });

        // Form
        const form = contentEl.createDiv({ cls: 'ps-form-container' });

        // Title field
        const titleGroup = form.createDiv({ cls: 'ps-form-group' });
        titleGroup.createEl('label', { text: 'Title', cls: 'ps-form-label' });

        const titleInput = titleGroup.createEl('input', { type: 'text', placeholder: 'Brief description of the issue', cls: 'ps-form-input' });
        titleInput.addEventListener('input', (e) => {
            this.title = (e.target as HTMLInputElement).value;
        });

        // Body field
        const bodyGroup = form.createDiv({ cls: 'ps-form-group' });
        bodyGroup.createEl('label', { text: 'Description', cls: 'ps-form-label' });
        bodyGroup.createDiv({ text: 'Markdown supported', cls: 'ps-form-hint' });

        const bodyTextarea = bodyGroup.createEl('textarea', { placeholder: 'Describe the issue in detail...\n\n## Steps to reproduce\n1. \n2. \n\n## Expected behavior\n\n## Actual behavior', cls: 'ps-form-textarea' });
        bodyTextarea.addEventListener('input', (e) => {
            this.body = (e.target as HTMLTextAreaElement).value;
        });

        // Tips
        const tips = form.createDiv({ cls: 'ps-form-tips' });
        tips.createEl('strong', { text: '💡 Tips for a good issue:' });
        const tipsList = tips.createEl('ul');
        tipsList.createEl('li', { text: 'Use a clear, descriptive title' });
        tipsList.createEl('li', { text: 'Include steps to reproduce (if applicable)' });
        tipsList.createEl('li', { text: 'Add screenshots or code snippets' });

        // Footer
        const footer = contentEl.createDiv({ cls: 'ps-modal-footer' });

        const cancelBtn = footer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();

        const submitBtn = footer.createEl('button', { text: '🐛 Create issue', cls: 'mod-cta ps-btn-with-icon' });
        submitBtn.onclick = async () => {
            if (!this.title.trim()) {
                new Notice('⚠️ Title is required');
                titleInput.focus();
                titleInput.addClass('ps-input-error');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.setText('Creating...');

            try {
                const issue = await this.githubAPI.createIssue(
                    this.repoInfo.owner,
                    this.repoInfo.repo,
                    this.title,
                    this.body
                );
                new Notice(`✅ Issue #${issue.number} created!`);
                this.close();
                window.open(issue.html_url);
            } catch (e: unknown) {
                const err = e as { message?: string };
                new Notice(`❌ Error: ${err.message || 'Unknown error'}`);
                submitBtn.disabled = false;
                submitBtn.setText('🐛 Create Issue');
            }
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
