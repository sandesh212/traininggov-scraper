export interface EvidenceNode {
    text: string;
    children: EvidenceNode[];
}

export function parseEvidenceHierarchy(text: string): EvidenceNode[] {
    if (!text) return [];

    const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
    const rootNodes: EvidenceNode[] = [];
    let currentRoot: EvidenceNode | null = null;

    // Helper to check bullet types
    const isBlackBullet = (l: string) => l.startsWith('•');
    const isWhiteBullet = (l: string) => l.startsWith('◦');

    // Helper to clean text
    const cleanLine = (l: string) => l.replace(/^[•◦\-\*]\s*/, '').trim();

    lines.forEach(line => {
        if (isBlackBullet(line)) {
            // New top-level item
            currentRoot = { text: cleanLine(line), children: [] };
            rootNodes.push(currentRoot);
        } else if (isWhiteBullet(line)) {
            // Sub-item
            if (currentRoot) {
                currentRoot.children.push({ text: cleanLine(line), children: [] });
            } else {
                // Fallback: treat as root if no parent exists
                currentRoot = { text: cleanLine(line), children: [] };
                rootNodes.push(currentRoot);
            }
        } else {
            // Continuation or plain text
            // If it looks like a list item but not one of our specific bullets (e.g. "-"), treat as root?
            // Or append to previous?
            // User logic: "• is new, ◦ is sub".
            // Let's assume anything else is a continuation of the last active node.

            if (currentRoot) {
                // Check if we should append to the last child or the root itself
                if (currentRoot.children.length > 0) {
                    // Append to last child
                    const lastChild = currentRoot.children[currentRoot.children.length - 1];
                    lastChild.text += " " + line;
                } else {
                    // Append to root
                    currentRoot.text += " " + line;
                }
            } else {
                // No root yet, create one
                currentRoot = { text: line, children: [] };
                rootNodes.push(currentRoot);
            }
        }
    });

    return rootNodes;
}
