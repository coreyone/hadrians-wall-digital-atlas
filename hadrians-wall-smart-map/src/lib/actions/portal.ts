export function portal(node: HTMLElement, targetId: string = 'overlay-root') {
    let targetElement = document.getElementById(targetId);

    // Fallback to body if target isn't found
    if (!targetElement) {
        console.warn(`Portal target '${targetId}' not found. Falling back to document.body`);
        targetElement = document.body;
    }

    targetElement.appendChild(node);

    return {
        update(newTargetId: string) {
            const newTargetElement = document.getElementById(newTargetId) || document.body;
            newTargetElement.appendChild(node);
        },
        destroy() {
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }
    };
}
