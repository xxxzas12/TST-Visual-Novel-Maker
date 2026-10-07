import { t as tr } from '../../../shared/i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import type { Project } from '../../../shared/types';
import { createAction } from '../../../shared/actions';
import { deriveFlowEdges, type FlowEdge } from '../../../shared/flow';
import { useProject } from '../../store/project';
import { resolveAppearance } from '../../appearance';
import { toast, useUi } from '../../store/ui';
import { addScene, findScene } from '../../sceneOps';

type SceneNodeData = { name: string; chapter: string; actions: number; isStart: boolean; isEnding: boolean };
type StartNodeData = Record<string, never>;

function SceneNode({ data, selected }: NodeProps<Node<SceneNodeData>>) {
  return (
    <div className={`flow-node ${selected ? 'selected' : ''} ${data.isStart ? 'start' : ''}`} data-testid={`flow-node-${data.name}`}>
      <Handle type="target" position={Position.Left} />
      <div className="ch">{data.chapter}</div>
      <b>
        {data.isStart ? '🚩 ' : data.isEnding ? '🏁 ' : '🎬 '}
        {data.name}
      </b>
      <div className="small faint">{tr("{0} actions", { 0: data.actions })}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function StartNode() {
  return (
    <div className="flow-node start" style={{ minWidth: 0, background: 'rgba(62,207,142,.15)' }}>
      <b>{tr("▶ START")}</b>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { scene: SceneNode, start: StartNode };

function chapterName(p: Project, sceneId: string) {
  return p.chapters.find((c) => c.sceneIds.includes(sceneId))?.name ?? '';
}

export function FlowView() {
  const project = useProject((s) => s.project)!;
  const [mode, setMode] = useState<'flow' | 'list'>('flow');
  const appearance = useUi((s) => s.appearance);
  const flowEdges = useMemo(() => deriveFlowEdges(project), [project]);
  const startId = project.settings.startSceneId;

  const nodes: Node[] = useMemo(() => {
    const out: Node[] = project.scenes.map((s, i) => ({
      id: s.id,
      type: 'scene',
      position: s.flowPos ?? { x: 80 + (i % 5) * 260, y: 80 + Math.floor(i / 5) * 160 },
      data: {
        name: s.name,
        chapter: chapterName(project, s.id),
        actions: s.actions.length,
        isStart: s.id === startId,
        isEnding: s.actions.some((a) => a.type === 'endGame' && !a.disabled),
      } satisfies SceneNodeData,
    }));
    const start = project.scenes.find((s) => s.id === startId);
    const sp = start?.flowPos ?? { x: 80, y: 80 };
    out.push({ id: '__start', type: 'start', position: { x: sp.x - 170, y: sp.y + 14 }, data: {} satisfies StartNodeData, draggable: false });
    return out;
  }, [project, startId]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = flowEdges.map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      label: e.label && e.kind !== 'next' ? tr(e.label).slice(0, 28) : undefined,
      animated: e.kind === 'choice',
      style: e.kind === 'next' ? { strokeDasharray: '6 4', stroke: '#6b7290' } : e.kind === 'condition' ? { stroke: '#3ecf8e' } : e.kind === 'choice' ? { stroke: '#9a6bff' } : { stroke: '#6d7cff' },
      markerEnd: { type: MarkerType.ArrowClosed },
      labelStyle: { fill: '#e8eaf4', fontSize: 11 },
      labelBgStyle: { fill: '#1d2131' },
      data: { kind: e.kind },
    }));
    if (startId) out.push({ id: '__start-edge', source: '__start', target: startId, style: { stroke: '#3ecf8e' }, markerEnd: { type: MarkerType.ArrowClosed }, deletable: false });
    return out;
  }, [flowEdges, startId]);

  // React Flow keeps measured sizes and selection on its node/edge objects, so we keep
  // local copies synced from the project instead of handing it fresh objects each render.
  const [rfNodes, setRfNodes] = useState<Node[]>(nodes);
  const [rfEdges, setRfEdges] = useState<Edge[]>(edges);
  useEffect(() => {
    setRfNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]));
      return nodes.map((n) => {
        const o = old.get(n.id);
        return o ? { ...n, measured: o.measured, selected: o.selected, dragging: o.dragging, position: o.dragging ? o.position : n.position } : n;
      });
    });
  }, [nodes]);
  useEffect(() => {
    setRfEdges((prev) => {
      const old = new Map(prev.map((e) => [e.id, e]));
      return edges.map((e) => ({ ...e, selected: old.get(e.id)?.selected }));
    });
  }, [edges]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((eds) => applyEdgeChanges(changes.filter((c) => c.type !== 'remove'), eds));
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((nds) => applyNodeChanges(changes.filter((c) => c.type !== 'remove'), nds));
    const moves = changes.filter((c): c is Extract<NodeChange, { type: 'position' }> => c.type === 'position' && !!c.position && c.id !== '__start');
    if (!moves.length) return;
    useProject.getState().update((p) => {
      for (const m of moves) {
        const s = findScene(p, m.id);
        if (s && m.position) s.flowPos = { x: Math.round(m.position.x), y: Math.round(m.position.y) };
      }
    }, 'flow-drag');
  }, []);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    if (c.source === '__start') {
      useProject.getState().update((p) => void (p.settings.startSceneId = c.target!));
      toast(tr("Start scene changed"), 'success');
      return;
    }
    useProject.getState().update((p) => {
      const s = findScene(p, c.source);
      if (!s) return;
      const last = [...s.actions].reverse().find((a) => !a.disabled);
      if (last && (last.type === 'jumpScene' || last.type === 'changeScene')) last.params.sceneId = c.target;
      else s.actions.push(createAction('jumpScene', { sceneId: c.target }));
    });
    toast(tr("Connected: a “Jump to Scene” action was added"), 'success');
  }, []);

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      const byId = new Map<string, FlowEdge>(flowEdges.map((e) => [e.id, e]));
      useProject.getState().update((p) => {
        for (const d of deleted) {
          const fe = byId.get(d.id);
          if (!fe) continue;
          if (fe.kind === 'next') {
            toast(tr("That dashed arrow means “continue to the next scene”. Add an End Game or Jump action to change it."), 'info');
            continue;
          }
          const s = findScene(p, fe.from);
          const a = s?.actions.find((x) => x.id === fe.actionId);
          if (!s || !a) continue;
          if (a.type === 'choice') {
            const optId = d.id.split(':')[1];
            const o = a.params.options.find((x: any) => x.id === optId);
            if (o) o.target = { kind: 'next' };
          } else if (a.type === 'conditional') {
            const side = d.id.endsWith(':then') ? 'then' : 'else';
            a.params[side] = { kind: 'next' };
          } else {
            s.actions = s.actions.filter((x) => x.id !== a.id);
          }
        }
      });
    },
    [flowEdges],
  );

  const autoLayout = () =>
    useProject.getState().update((p) => {
      p.chapters.forEach((ch, ci) =>
        ch.sceneIds.forEach((sid, si) => {
          const s = findScene(p, sid);
          if (s) s.flowPos = { x: 120 + si * 270, y: 60 + ci * 190 };
        }),
      );
    });

  const open = (sceneId: string) => {
    useUi.getState().selectScene(sceneId);
    useUi.getState().setView('scenes');
  };

  return (
    <>
      <div className="view-header">
        <h2>{tr("Story Flow")}</h2>
        <div className="row" style={{ gap: '0.2rem' }}>
          <button className={`btn sm ${mode === 'flow' ? 'active' : ''}`} onClick={() => setMode('flow')} data-testid="flow-mode">
            {tr("🔀 Flow View")}
          </button>
          <button className={`btn sm ${mode === 'list' ? 'active' : ''}`} onClick={() => setMode('list')} data-testid="list-mode">
            {tr("☰ List View")}
          </button>
        </div>
        <span className="grow" />
        {mode === 'flow' && (
          <>
            <span className="small muted">{tr("Drag from a scene’s right dot to another scene to connect · select an arrow + Delete to remove · double-click to edit")}</span>
            <button className="btn sm" onClick={autoLayout}>
              {tr("⊞ Auto-arrange")}
            </button>
          </>
        )}
        <button className="btn sm primary" onClick={() => addScene()}>
          {tr("＋ Scene")}
        </button>
      </div>
      {mode === 'flow' ? (
        <div className="flow-wrap" data-testid="flow-canvas">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onNodeDoubleClick={(_, n) => n.id !== '__start' && open(n.id)}
            colorMode={resolveAppearance(appearance)}
            fitView
            deleteKeyCode={['Delete', 'Backspace']}
            minZoom={0.2}
          >
            <Background gap={24} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      ) : (
        <div className="view-body">
          {project.chapters.map((ch) => (
            <div key={ch.id} style={{ marginBottom: '1.2rem' }}>
              <div className="section-title">📖 {ch.name}</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>{tr("Scene")}</th>
                    <th style={{ width: '6rem' }}>{tr("Actions")}</th>
                    <th>{tr("Goes to")}</th>
                  </tr>
                </thead>
                <tbody>
                  {ch.sceneIds.map((sid) => {
                    const s = findScene(project, sid);
                    if (!s) return null;
                    const outs = flowEdges.filter((e) => e.from === sid);
                    return (
                      <tr key={sid} style={{ cursor: 'pointer' }} onClick={() => open(sid)}>
                        <td>
                          {sid === startId ? '🚩 ' : ''}
                          <b>{s.name}</b>
                        </td>
                        <td className="muted">{s.actions.length}</td>
                        <td>
                          <div className="tags">
                            {outs.length === 0 && <span className="badge">{tr("🏁 ends")}</span>}
                            {outs.map((e) => (
                              <span key={e.id} className={`badge ${e.kind === 'choice' ? 'accent' : e.kind === 'condition' ? 'ok' : ''}`}>
                                {e.kind === 'choice' ? `“${e.label}” → ` : e.kind === 'condition' ? `${tr(e.label)} → ` : e.kind === 'next' ? tr("then → ") : '→ '}
                                {findScene(project, e.to)?.name}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
