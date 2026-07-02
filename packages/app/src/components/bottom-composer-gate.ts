export interface BottomComposerGateInputs {
  terminalVisible: boolean;
  isEmbedded: boolean;
  activeDocName: string | null;
}

export function shouldShowBottomComposer(inputs: BottomComposerGateInputs): boolean {
  return !inputs.terminalVisible && !inputs.isEmbedded && inputs.activeDocName !== null;
}

export function shouldShowFolderComposer(
  inputs: Omit<BottomComposerGateInputs, 'activeDocName'>,
): boolean {
  return !inputs.terminalVisible && !inputs.isEmbedded;
}
