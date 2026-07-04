/**
 * Unit tests for the WYSIWYG clipboard serializers.
 *
 * The HTML serializer's DOM-traversal happy path requires a real DOM
 * (DOMParser + document.createDocumentFragment) which bun-test does not
 * provide; that path is covered by the paste-fidelity E2E suite
 * (`packages/app/tests/stress/paste-fidelity.e2e.ts`).
 *
 * Here we cover what bun-test CAN reach without DOM:
 *   - text serializer happy path + failure-fallthrough;
 *   - HTML serializer's walker→markdown tier dispatch logic — the
 *     decision to enter walker, the catch-and-fallthrough on walker
 *     throw, and the markdown tier's no-schema short-circuit. This pins
 *     the regression class "catch block removed"
 *     mechanically rather than relying on E2E to surface it.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { JSONContent } from '@tiptap/core';
import type { Fragment } from '@tiptap/pm/model';
import { Schema } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';

import {
  createClipboardHtmlSerializer,
  createClipboardTextSerializer,
  findDescriptorRoot,
  sliceToDocJson,
} from './serialize.ts';

// Minimal schema that lets us synthesise a `doc > paragraph > text` tree.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'text*',
      toDOM: () => ['p', 0],
      parseDOM: [{ tag: 'p' }],
    },
    text: { group: 'inline' },
  },
});

function makeSlice(text: string) {
  const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text(text)])]);
  return doc.slice(0, doc.content.size);
}

// The serializer normalizes the slice to a synthetic top-level doc JSON
// via `schema.topNodeType.createAndFill` + `.toJSON()`. Our fake manager
// receives that JSON shape and reaches into `doc > paragraph > text`.
function fakeMdManager() {
  return {
    serialize: mock((doc: JSONContent) => {
      const p = doc.content?.[0]?.content?.[0]?.text ?? '';
      return `# ${p}`;
    }),
    parse: mock(() => ({ type: 'doc', content: [] })),
  };
}

function fakeView() {
  return { state: { schema } } as unknown as Parameters<
    ReturnType<typeof createClipboardTextSerializer>
  >[1];
}

let origWarn: typeof console.warn;
beforeEach(() => {
  origWarn = console.warn;
  console.warn = () => {};
});
afterEach(() => {
  console.warn = origWarn;
});

describe('createClipboardTextSerializer', () => {
  test('produces markdown from a slice via MarkdownManager.serialize', () => {
    const md = fakeMdManager();
    // biome-ignore lint/suspicious/noExplicitAny: fake md manager shape
    const serializer = createClipboardTextSerializer({ mdManager: md as any });
    const text = serializer(makeSlice('hello'), fakeView());
    expect(text).toBe('# hello');
    expect(md.serialize).toHaveBeenCalledTimes(1);
  });

  test('falls through to PM textBetween on serialize throw', () => {
    const md = fakeMdManager();
    md.serialize = mock(() => {
      throw new Error('boom');
    });
    // biome-ignore lint/suspicious/noExplicitAny: fake md manager shape
    const serializer = createClipboardTextSerializer({ mdManager: md as any });
    const text = serializer(makeSlice('hello world'), fakeView());
    // textBetween yields the literal text; the serializer fell through.
    expect(text).toContain('hello world');
  });

  test('never throws — even on an empty-selection slice', () => {
    const md = fakeMdManager();
    // biome-ignore lint/suspicious/noExplicitAny: fake md manager shape
    const serializer = createClipboardTextSerializer({ mdManager: md as any });
    const emptyDoc = schema.node('doc', null, [schema.node('paragraph')]);
    const slice = emptyDoc.slice(0, emptyDoc.content.size);
    expect(() => serializer(slice, fakeView())).not.toThrow();
  });
});

describe('createClipboardHtmlSerializer — walker→markdown tier dispatch', () => {
  // These tests pin the dispatch logic in `MdastClipboardSerializer.serializeFragment`
  // without invoking the DOM-dependent paths. The walker and markdown tiers
  // both need DOM to actually emit content (via `walkLiveDomToInlineStyledFragment`
  // and `parseHtmlToDocumentFragment` respectively); we exercise the *decision*
  // to enter each tier and the fallthrough behavior on walker throw, by feeding
  // a fragment with no firstChild — the markdown tier short-circuits at the
  // schema lookup before reaching `parseHtmlToDocumentFragment`.

  // A fragment whose firstChild is null. Triggers the markdown tier's
  // `if (!schema) return target` short-circuit, sidestepping DOM.
  function emptyFragment(): Fragment {
    return { firstChild: null } as unknown as Fragment;
  }

  // Sentinel target object — proxies as a DocumentFragment so the
  // serializer's `target ?? ...` arms cleanly. Identity preserved through
  // the call chain when no DOM is touched.
  function sentinelTarget(): DocumentFragment {
    return {} as DocumentFragment;
  }

  // Inner-scoped save so we don't shadow the module-level `origWarn` that
  // the text-serializer block's hooks captured. Without this, a future
  // test added below this describe block would restore to a no-op rather
  // than the true original `console.warn`.
  let warnCalls: string[];
  let innerOrigWarn: typeof console.warn;
  beforeEach(() => {
    warnCalls = [];
    innerOrigWarn = console.warn;
    console.warn = (msg: unknown) => {
      warnCalls.push(typeof msg === 'string' ? msg : String(msg));
    };
  });
  afterEach(() => {
    console.warn = innerOrigWarn;
  });

  test('view attached + active selection + walker throws → catch fires + markdown tier returns target', () => {
    // Mock view: from !== to (walker tier entry) and `selection.content()`
    // throws synchronously to exercise the walker catch block.
    const view = {
      state: {
        selection: {
          from: 0,
          to: 5,
          content: () => {
            throw new Error('walker-boom');
          },
        },
      },
    } as unknown as EditorView;

    const md = fakeMdManager();
    const handle = createClipboardHtmlSerializer({
      // biome-ignore lint/suspicious/noExplicitAny: fake md manager shape
      mdManager: md as any,
    });
    handle.setView(view);

    const target = sentinelTarget();
    const result = handle.serializer.serializeFragment(emptyFragment(), undefined, target);

    // Walker catch block emitted the structured failure event with the
    // `walker:` reason prefix — pins the regression class "catch removed"
    // mechanically.
    const failEvent = warnCalls.find((w) => w.includes('clipboard-serialize-failed'));
    expect(failEvent).toBeDefined();
    expect(failEvent).toContain('walker:walker-boom');

    // Markdown tier ran and returned the target sentinel (no-schema branch),
    // not a fresh DocumentFragment — i.e. the fallthrough actually happened.
    expect(result).toBe(target);
  });

  test('no view attached → walker tier skipped → markdown tier returns target', () => {
    const md = fakeMdManager();
    const handle = createClipboardHtmlSerializer({
      // biome-ignore lint/suspicious/noExplicitAny: fake md manager shape
      mdManager: md as any,
    });

    const target = sentinelTarget();
    const result = handle.serializer.serializeFragment(emptyFragment(), undefined, target);

    // No walker-failure event since the walker tier never fired.
    expect(warnCalls.find((w) => w.includes('walker:'))).toBeUndefined();
    expect(result).toBe(target);
  });

  test('collapsed selection (from === to) → walker tier skipped → markdown tier returns target', () => {
    // Drag-out from a collapsed cursor: the walker tier guard skips
    // entering, sidestepping `selection.content()` entirely. The mock's
    // `content()` throws to assert it's *not* called.
    const view = {
      state: {
        selection: {
          from: 0,
          to: 0,
          content: () => {
            throw new Error('should-not-be-called');
          },
        },
      },
    } as unknown as EditorView;

    const md = fakeMdManager();
    const handle = createClipboardHtmlSerializer({
      // biome-ignore lint/suspicious/noExplicitAny: fake md manager shape
      mdManager: md as any,
    });
    handle.setView(view);

    const target = sentinelTarget();
    const result = handle.serializer.serializeFragment(emptyFragment(), undefined, target);

    // No walker-tier engagement — content() was never called.
    expect(warnCalls.find((w) => w.includes('walker:'))).toBeUndefined();
    // Markdown tier returned the target sentinel — sibling-symmetric
    // assertion with the two preceding tests.
    expect(result).toBe(target);
  });
});

describe('createClipboardHtmlSerializer — walker env wires markdown reconstruction', () => {
  // The walker env carries a `serializeElementMarkdown` closure that the
  // URL-portability classifier post-pass calls to reconstruct source-
  // fallback content. The closure encapsulates posAtDOM → nodeAt → slice
  // → mdManager.serialize so the walker stays decoupled from EditorView
  // / MarkdownManager. These tests verify the closure construction
  // surface — full DOM behavior of the URL-classifier swap is in
  // Playwright (sanitizer-proxy fixtures + paste-fidelity stress).

  let warnCalls: string[];
  let innerOrigWarn: typeof console.warn;
  beforeEach(() => {
    warnCalls = [];
    innerOrigWarn = console.warn;
    console.warn = (msg: unknown) => {
      warnCalls.push(typeof msg === 'string' ? msg : String(msg));
    };
  });
  afterEach(() => {
    console.warn = innerOrigWarn;
  });

  test('walker tier receives an env with `serializeElementMarkdown` when view is attached', () => {
    // Drives the dispatch through the walker tier by giving it an active
    // selection. We can't run the real walker in bun-test (no DOM), but
    // we CAN assert the walker is called with an env carrying the
    // closure. The mock-throw inside `selection.content()` short-circuits
    // before the walker actually runs — sufficient to confirm the
    // serializer is plumbing env construction.
    const view = {
      // posAtDOM is never invoked here because `selection.content()`
      // throws first inside the walker tier; stub returns a valid
      // non-negative position so the type contract reads honestly
      // (real PM throws RangeError on detached elements, never returns
      // a negative sentinel — see prosemirror-view EditorView.posAtDOM).
      posAtDOM: () => 0,
      state: {
        schema: {} as Schema,
        selection: {
          from: 0,
          to: 5,
          content: () => {
            throw new Error('walker-boom');
          },
        },
        doc: {
          nodeAt: () => null,
          slice: () => ({ content: { toJSON: () => [] } }),
        },
      },
    } as unknown as EditorView;
    const md = fakeMdManager();
    const handle = createClipboardHtmlSerializer({
      // biome-ignore lint/suspicious/noExplicitAny: fake md manager shape
      mdManager: md as any,
    });
    handle.setView(view);
    const target = {} as DocumentFragment;
    handle.serializer.serializeFragment(
      { firstChild: null } as unknown as Fragment,
      undefined,
      target,
    );
    // Walker entered, threw at `selection.content()` — telemetry was
    // emitted with `walker:` prefix per the regression-class catch
    // block contract.
    const failEvent = warnCalls.find((w) => w.includes('clipboard-serialize-failed'));
    expect(failEvent).toBeDefined();
    expect(failEvent).toContain('walker:walker-boom');
  });
});

// bun-test has no DOM. The fake-element shape below covers exactly the
// surface `findDescriptorRoot` touches: `classList.contains`,
// `hasAttribute`, and the `parentElement` traversal getter. Following the
// existing `clipboard-walker.test.ts` post-pass convention.
interface FakeDescriptorElement {
  parentElement: FakeDescriptorElement | null;
  classes: Set<string>;
  attrs: Set<string>;
}

function makeDescriptorEl(opts?: { classes?: string[]; attrs?: string[] }): FakeDescriptorElement {
  return {
    parentElement: null,
    classes: new Set(opts?.classes ?? []),
    attrs: new Set(opts?.attrs ?? []),
  };
}

/** Build a parent → child chain. Returns the leaf (deepest descendant). */
function chainDescriptorEls(...els: FakeDescriptorElement[]): FakeDescriptorElement {
  for (let i = 1; i < els.length; i++) {
    els[i].parentElement = els[i - 1];
  }
  return els[els.length - 1];
}

function wrapDescriptor(el: FakeDescriptorElement): Element {
  return {
    classList: { contains: (c: string) => el.classes.has(c) },
    hasAttribute: (a: string) => el.attrs.has(a),
    get parentElement() {
      return el.parentElement === null ? null : wrapDescriptor(el.parentElement);
    },
  } as unknown as Element;
}

describe('findDescriptorRoot — outermost-wrapper selection', () => {
  // Regression pin: `findDescriptorRoot` must return the OUTERMOST matching
  // ancestor, not the first one found. CommonMarkImage renders as nested
  // `react-renderer > [data-node-view-wrapper data-jsx-component]` wrappers
  // and PM positions the outer one. A regression to "first match" would
  // silently break the descriptor-rendered cross-app paste path.

  test('(a) bare element with only ProseMirror parent → returns null', () => {
    // Inline `<a>` mark text: raw PM content, no NodeView descriptor.
    const proseMirror = makeDescriptorEl({ classes: ['ProseMirror'] });
    const img = makeDescriptorEl();
    const live = chainDescriptorEls(proseMirror, img);
    expect(findDescriptorRoot(wrapDescriptor(live))).toBeNull();
  });

  test('(b) single .react-renderer wrapper → returns that wrapper', () => {
    // `.ProseMirror > .react-renderer > <img>` — classic single descriptor.
    const proseMirror = makeDescriptorEl({ classes: ['ProseMirror'] });
    const reactRenderer = makeDescriptorEl({ classes: ['react-renderer'] });
    const img = makeDescriptorEl();
    const live = chainDescriptorEls(proseMirror, reactRenderer, img);
    const root = findDescriptorRoot(wrapDescriptor(live));
    expect(root).not.toBeNull();
    expect(root?.classList.contains('react-renderer')).toBe(true);
  });

  test('(c) nested wrappers → returns the OUTERMOST wrapper (CRITICAL — load-bearing)', () => {
    // CommonMarkImage shape:
    //   .ProseMirror > .react-renderer > [data-node-view-wrapper data-jsx-component] > <img>
    // Both the `.react-renderer` AND the `[data-node-view-wrapper]`
    // ancestor match. The function MUST return the outer `.react-renderer`
    // — that's what PM positions in its parent's content. A "first match"
    // regression would return the inner data-node-view-wrapper and PM's
    // `posAtDOM` would resolve to a position INSIDE the descriptor's
    // opaque atom content, `nodeAt` returns null, and the source-fallback
    // emit silently no-ops.
    const proseMirror = makeDescriptorEl({ classes: ['ProseMirror'] });
    const reactRenderer = makeDescriptorEl({ classes: ['react-renderer'] });
    const innerWrapper = makeDescriptorEl({
      attrs: ['data-node-view-wrapper', 'data-jsx-component'],
    });
    const img = makeDescriptorEl();
    const live = chainDescriptorEls(proseMirror, reactRenderer, innerWrapper, img);

    const root = findDescriptorRoot(wrapDescriptor(live));
    expect(root).not.toBeNull();
    // The outermost `.react-renderer` wins. Inner wrapper would also have
    // matched if the function used "first-match-wins" — pin BOTH the
    // positive (outer matches) and the negative (inner is NOT returned).
    expect(root?.classList.contains('react-renderer')).toBe(true);
    expect(root?.hasAttribute('data-node-view-wrapper')).toBe(false);
  });

  test('(d) climbing stops at the .ProseMirror boundary', () => {
    // A `.react-renderer` ancestor BEYOND `.ProseMirror` (e.g. an outer
    // page chrome wrapper) must NOT be returned — the editor root is the
    // upper bound for descriptor traversal.
    const outerChrome = makeDescriptorEl({ classes: ['react-renderer'] });
    const proseMirror = makeDescriptorEl({ classes: ['ProseMirror'] });
    const img = makeDescriptorEl();
    const live = chainDescriptorEls(outerChrome, proseMirror, img);

    const root = findDescriptorRoot(wrapDescriptor(live));
    expect(root).toBeNull();
  });

  test('(e) detached element with no .ProseMirror ancestor → returns null', () => {
    // `parentElement` reaches null before any descriptor wrapper appears
    // (and never hits `.ProseMirror`). Loop exit is the null parent, not
    // the boundary check — assert the null fallback.
    const detached = makeDescriptorEl();
    const root = findDescriptorRoot(wrapDescriptor(detached));
    expect(root).toBeNull();
  });

  test('(f) wrappers carrying `data-clipboard-inline-leaf` are skipped (ImageInlineZoom opt-out)', () => {
    // `ImageInlineZoom` wraps inline `<img>` in `<NodeViewWrapper as="span"
    // data-image-inline-zoom data-clipboard-inline-leaf="image">` so
    // click-to-enlarge works mid-prose. The wrapper carries
    // `data-node-view-wrapper` (tiptap stamps it on every NodeViewWrapper)
    // — without the opt-out, `findDescriptorRoot` would match the wrapper
    // and route clipboard serialization through the descriptor-parent
    // codepath (`posAtDOM(<p>, idx, -1)`), which has different mark-
    // interaction semantics than the direct `posAtDOM(<img>, 0)` path the
    // bare PM image node used. The opt-out preserves the pre-
    // existing clipboard behavior with zero risk surface. A regression
    // that drops the skip would silently re-introduce the routing change.
    const proseMirror = makeDescriptorEl({ classes: ['ProseMirror'] });
    const para = makeDescriptorEl();
    const inlineLeafWrapper = makeDescriptorEl({
      attrs: ['data-node-view-wrapper', 'data-clipboard-inline-leaf'],
    });
    const img = makeDescriptorEl();
    const live = chainDescriptorEls(proseMirror, para, inlineLeafWrapper, img);

    expect(findDescriptorRoot(wrapDescriptor(live))).toBeNull();
  });

  test('(g) opt-out is wrapper-local — a real descriptor BEYOND the inline-leaf wrapper still matches (defense against accidental no-op for nested cases)', () => {
    // Pin that `data-clipboard-inline-leaf` only skips THAT wrapper, not
    // the rest of the climb. If a future schema nests `ImageInlineZoom`
    // inside a block descriptor (hypothetical, but the walker shouldn't
    // care), the outer block descriptor must still be found.
    const proseMirror = makeDescriptorEl({ classes: ['ProseMirror'] });
    const outerReactRenderer = makeDescriptorEl({ classes: ['react-renderer'] });
    const inlineLeafWrapper = makeDescriptorEl({
      attrs: ['data-node-view-wrapper', 'data-clipboard-inline-leaf'],
    });
    const img = makeDescriptorEl();
    const live = chainDescriptorEls(proseMirror, outerReactRenderer, inlineLeafWrapper, img);

    const root = findDescriptorRoot(wrapDescriptor(live));
    expect(root).not.toBeNull();
    expect(root?.classList.contains('react-renderer')).toBe(true);
  });
});

describe('sliceToDocJson — inline-first wrapping branch', () => {
  // Regression pin: a slice whose firstChild is INLINE (e.g. an inline
  // image atom from `<p>prose <img> more</p>`) must be wrapped in a
  // paragraph before `schema.topNodeType.createAndFill`. Without the
  // wrap, top-level inline content is rejected by `doc`'s `block+`
  // content rule, `createAndFill` returns null, the empty-doc fallback
  // fires, and `mdManager.serialize` produces an empty string instead
  // of `![alt](src)` — the inline-image cross-app paste path silently
  // drops content.

  // Schema with both block paragraph and an inline atom image. The image
  // node is `inline: true, atom: true` so that an arbitrary slice over
  // it has `firstChild.isInline === true`.
  const inlineImageSchema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: {
        group: 'block',
        content: 'inline*',
        toDOM: () => ['p', 0],
        parseDOM: [{ tag: 'p' }],
      },
      image: {
        group: 'inline',
        inline: true,
        atom: true,
        attrs: { src: { default: '' }, alt: { default: '' } },
        toDOM: (node) => ['img', { src: node.attrs.src, alt: node.attrs.alt }],
        parseDOM: [{ tag: 'img' }],
      },
      text: { group: 'inline' },
    },
  });

  test('inline-first slice → wraps in paragraph, doc JSON contains image atom', () => {
    // Build a slice whose firstChild is the inline image atom (not a
    // paragraph). Construct the image as an inline atom node directly
    // and place it in a Fragment, then synthesize a slice via
    // `Slice.maxOpen` so the slice's `content.firstChild` is the atom.
    const img = inlineImageSchema.node('image', { src: 'cat.png', alt: 'cat' });
    // A slice over the inline image alone — firstChild is the image atom.
    const paragraph = inlineImageSchema.node('paragraph', null, [img]);
    // Slice the paragraph's content — the slice's firstChild is the inline
    // atom directly, not the paragraph. positions inside the paragraph:
    //   <p>0  [img] 1  </p>
    // so paragraph.content.size === 1.
    const slice = paragraph.slice(0, paragraph.content.size);
    expect(slice.content.firstChild?.isInline).toBe(true);

    const docJson = sliceToDocJson(slice, inlineImageSchema);

    // Doc has at least one block child — the synthesized paragraph
    // wrapper. Without the wrap branch, `createAndFill` would have
    // returned null (inline at top-level violates `block+`) and the
    // empty-doc fallback would have produced a doc with an EMPTY
    // paragraph, not one containing the image atom.
    expect(docJson.type).toBe('doc');
    const firstBlock = docJson.content?.[0];
    expect(firstBlock?.type).toBe('paragraph');
    const firstInline = firstBlock?.content?.[0];
    expect(firstInline?.type).toBe('image');
    expect(firstInline?.attrs?.src).toBe('cat.png');
  });

  test('block-first slice → no wrap, doc JSON nests block directly under doc', () => {
    // Sibling-symmetric coverage: when the slice already starts with a
    // block, the `if (first?.isInline)` guard must NOT wrap (would
    // double-nest a paragraph inside a paragraph).
    const img = inlineImageSchema.node('image', { src: 'cat.png', alt: 'cat' });
    const paragraph = inlineImageSchema.node('paragraph', null, [img]);
    const doc = inlineImageSchema.node('doc', null, [paragraph]);
    const slice = doc.slice(0, doc.content.size);
    expect(slice.content.firstChild?.isInline).toBe(false);
    expect(slice.content.firstChild?.type.name).toBe('paragraph');

    const docJson = sliceToDocJson(slice, inlineImageSchema);

    expect(docJson.type).toBe('doc');
    expect(docJson.content?.[0]?.type).toBe('paragraph');
    // Image is one level deep, NOT two — confirms no extra wrap was added.
    expect(docJson.content?.[0]?.content?.[0]?.type).toBe('image');
  });
});
