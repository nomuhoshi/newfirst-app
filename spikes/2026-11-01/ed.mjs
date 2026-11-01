import { EditorState, EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { history, undo, indentMore, indentLess, insertNewlineAndIndent } from "@codemirror/commands";
import { closeBrackets, insertBracket, deleteBracketPair } from "@codemirror/autocomplete";
import { python } from "@codemirror/lang-python";
import { indentUnit } from "@codemirror/language";
const view = new EditorView({ parent: document.body, state: EditorState.create({ doc: "",
  extensions: [history(), closeBrackets(), python(), indentUnit.of("    "), EditorState.tabSize.of(4),
    EditorView.contentAttributes.of({ inputmode: "none" })] }) });
function type(ch){ const tr = insertBracket(view.state, ch); if (tr) view.dispatch(tr);
  else view.dispatch(view.state.replaceSelection(ch), {scrollIntoView:true, userEvent:"input.type"}); }
const S = () => ({ doc: view.state.doc.toString(), sel: [view.state.selection.main.from, view.state.selection.main.to] });
const R = {};
type("("); R.autoPair = S();
type(")"); R.skipClose = S();
view.dispatch({changes:{from:0,to:view.state.doc.length,insert:""}});
type("("); deleteBracketPair(view); R.backspacePair = S();
view.dispatch({changes:{from:0,to:view.state.doc.length,insert:"abc"}, selection: EditorSelection.range(0,3)});
type('"'); R.wrapQuote = S();
view.dispatch({changes:{from:0,to:view.state.doc.length,insert:"if x:\n    a\nb"}, selection: EditorSelection.range(0,13)});
indentMore(view); R.indentAll = S(); indentLess(view); indentLess(view); R.dedentTwice = S();
view.dispatch({changes:{from:0,to:view.state.doc.length,insert:"for i in range(3):"}, selection: EditorSelection.cursor(18)});
insertNewlineAndIndent(view); R.colonEnter = S();
for (let i=0;i<25;i++) type("a"); let n=0; while (undo(view)) n++; R.undoSteps = n; R.afterUndo = S();
window.R = R;
