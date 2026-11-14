import { useEffect, useRef, useState } from "react";
import {
  Alert,
  App,
  Button,
  ConfigProvider,
  Empty,
  Input,
  Modal,
  Space,
  Spin,
  Tag,
} from "antd";
import { ArrowLeftOutlined, CopyOutlined } from "@ant-design/icons";
import {
  useBlocker,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api, ApiError, errorMessage } from "../../api/client";
import type {
  CalcItemInput,
  Coefficient,
  ProjectDetail,
} from "../../api/types";
import { RequestError } from "../../components/RequestError";
import { Section } from "../../components/Section";
import { useRemote } from "../../hooks/useRemote";
import { CoefficientPicker } from "./CoefficientPicker";
import { ParameterForm } from "./ParameterForm";
import { ResultsTable } from "./ResultsTable";
import {
  canComplete,
  editItem,
  emptyEditor,
  hydrateEditor,
  inputErrors,
  savePayload,
  selectCoefficients,
  serializeItems,
  type EditorState,
} from "./model";

function signature(state: EditorState): string {
  return JSON.stringify({
    projectName: state.projectName,
    items: state.items.map((item) => item.input),
  });
}

function CalculationEditor({
  initial,
  id = null,
  readOnly = false,
  copied = false,
  detail,
}: {
  initial: EditorState;
  id?: string | null;
  readOnly?: boolean;
  copied?: boolean;
  detail?: ProjectDetail;
}) {
  const [state, setState] = useState(initial);
  const [savedSignature, setSavedSignature] = useState(
    copied ? signature(emptyEditor) : signature(initial),
  );
  const [resultDirty, setResultDirty] = useState(false);
  const [busy, setBusy] = useState<"preview" | "save" | null>(null);
  const [error, setError] = useState("");
  const [completionRejected, setCompletionRejected] = useState(false);
  const busyRef = useRef(false);
  const bypassNavigation = useRef(false);
  const mounted = useRef(true);
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const dirty =
    !readOnly && (signature(state) !== savedSignature || resultDirty);
  const blocker = useBlocker(
    () => !bypassNavigation.current && (dirty || busyRef.current),
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!dirty && !busy) return;
    const confirmUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmUnload);
    return () => window.removeEventListener("beforeunload", confirmUnload);
  }, [dirty, busy]);

  function update(next: EditorState) {
    setState(next);
    setError("");
    setCompletionRejected(false);
  }

  function changeSelection(candidates: Coefficient[], selectedIds: string[]) {
    const items = selectCoefficients(state.items, candidates, selectedIds);
    if (
      JSON.stringify(items.map((item) => item.input)) ===
      JSON.stringify(state.items.map((item) => item.input))
    )
      return;
    update({ ...state, items, resultCurrent: false });
  }

  async function submit(kind: "preview" | "save", status: 1 | 2 = 1) {
    // 同步锁防止连续点击触发重复创建；请求失败保留当前表单，交由用户核对后重试。
    if (busyRef.current) return;
    if (status === 2 && (!canComplete(state) || completionRejected)) return;
    if (
      state.items.some(
        (item) => Object.keys(inputErrors(item.input)).length > 0,
      )
    ) {
      setError("存在超出范围的参数，请修正红色提示后再提交。");
      return;
    }
    busyRef.current = true;
    setBusy(kind);
    setError("");
    try {
      if (kind === "preview") {
        const result = await api.preview(serializeItems(state.items));
        if (!mounted.current) return;
        setState((current) => ({ ...current, result, resultCurrent: true }));
        setResultDirty(true);
        setCompletionRejected(false);
        message.success(`计算结束，${result.completed_count} 项已完成`);
      } else {
        const saved = await api.save(savePayload(state, id, status));
        if (!mounted.current) return;
        if (!saved.id)
          throw new Error("保存响应缺少项目 ID，请返回列表核对保存结果。");
        const next = hydrateEditor(saved);
        setState(next);
        setSavedSignature(signature(next));
        setResultDirty(false);
        message.success(status === 1 ? "已暂存" : "已保存");
        if (status === 2 || !id) {
          bypassNavigation.current = true;
          navigate(
            status === 2 ? "/calculations" : `/calculations/${saved.id}/edit`,
            { replace: true },
          );
        }
      }
    } catch (reason) {
      if (!mounted.current) return;
      const uncertainSave =
        kind === "save" &&
        reason instanceof ApiError &&
        (!reason.status || reason.status >= 500);
      setError(
        `${errorMessage(reason)}${uncertainSave ? "。保存结果尚未确认，请先返回列表核对，避免重复新建。" : ""}`,
      );
      if (status === 2) setCompletionRejected(true);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  return (
    <>
      <header className="page-heading editor-heading">
        <div>
          <Button
            className="back-button"
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/calculations")}
          >
            返回列表
          </Button>
          <h1>
            {readOnly
              ? state.projectName || "未命名计算"
              : id
                ? "编辑计算"
                : "二污普系数计算"}
            {readOnly && (
              <Tag color={detail?.status === 2 ? "success" : "warning"}>
                {detail?.status === 2 ? "已完成" : "暂存"}
              </Tag>
            )}
          </h1>
        </div>
        <Space wrap>
          {readOnly ? (
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={() => navigate(`/calculations/new?copy=${id}`)}
            >
              复制新建
            </Button>
          ) : (
            <>
              <Button
                onClick={() => submit("save", 1)}
                loading={busy === "save"}
                disabled={busy !== null}
              >
                暂存
              </Button>
              <Button
                type="primary"
                onClick={() => submit("save", 2)}
                loading={busy === "save"}
                disabled={
                  busy !== null || !canComplete(state) || completionRejected
                }
              >
                保存并关闭
              </Button>
            </>
          )}
          <Button
            disabled={busy !== null}
            onClick={() => navigate("/calculations")}
          >
            退出
          </Button>
        </Space>
      </header>
      <Alert
        className="scope-notice"
        type="info"
        title="本期计算范围为氮氧化物、二氧化硫、挥发性有机物（VOCs）、颗粒物和氟化物。请选择基础库中对应的废气污染物系数。"
      />
      <RequestError error={error} />
      <ConfigProvider componentDisabled={busy !== null}>
        <div className="project-name">
          <label htmlFor="project-name">项目名称</label>
          <Input
            id="project-name"
            value={state.projectName}
            maxLength={100}
            showCount
            disabled={readOnly || busy !== null}
            placeholder="请输入项目名称（选填）"
            onChange={(event) =>
              update({ ...state, projectName: event.target.value })
            }
          />
        </div>
        {readOnly && detail && (
          <div className="record-meta">
            创建人 {detail.create_by || "—"}
            <span>创建时间 {detail.gmt_create || "—"}</span>
            <span>更新时间 {detail.gmt_modified || "—"}</span>
          </div>
        )}
        <Section number={1} title="废气污染物指标">
          <CoefficientPicker
            readOnly={readOnly}
            items={state.items}
            onSelection={changeSelection}
            onRemove={(id) =>
              changeSelection(
                [],
                state.items
                  .filter((item) => item.input.coeff_id !== id)
                  .map((item) => item.input.coeff_id),
              )
            }
          />
        </Section>
        <Section
          number={2}
          title="计算参数填写"
          extra={
            <span className="muted small">
              每个计算项独立填写参数与计算依据
            </span>
          }
        >
          {state.items.length === 0 && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="请先选择产污系数"
            />
          )}
          {state.items.map((item, index) => (
            <ParameterForm
              key={item.input.coeff_id}
              item={item}
              index={index}
              readOnly={readOnly || busy !== null}
              result={
                state.resultCurrent
                  ? state.result?.list.find(
                      (row) => row.coeff_id === item.input.coeff_id,
                    )
                  : undefined
              }
              onChange={(patch: Partial<CalcItemInput>) =>
                update(editItem(state, item.input.coeff_id, patch))
              }
            />
          ))}
          {!readOnly && (
            <div className="calculation-footer">
              <Space>
                <Button
                  disabled={busy !== null || state.items.length === 0}
                  onClick={() =>
                    modal.confirm({
                      title: "清空全部计算参数？",
                      content:
                        "保留已选系数，清空填写的数值、计算依据及试算结果。",
                      okText: "清空",
                      onOk: () => {
                        const items = selectCoefficients(
                          [],
                          state.items.map((item) => item.coefficient),
                          state.items.map((item) => item.input.coeff_id),
                        );
                        update({
                          ...state,
                          items,
                          result: null,
                          resultCurrent: false,
                        });
                      },
                    })
                  }
                >
                  全部清空
                </Button>
                <Button
                  type="primary"
                  disabled={busy !== null || state.items.length === 0}
                  loading={busy === "preview"}
                  onClick={() => submit("preview")}
                >
                  计算（{state.items.length} 项）
                </Button>
              </Space>
            </div>
          )}
        </Section>
      </ConfigProvider>
      <Section number={3} title="计算结果">
        <ResultsTable result={state.result} current={state.resultCurrent} />
      </Section>
      <Modal
        title={busy ? "请求处理中" : "存在未保存的修改"}
        open={blocker.state === "blocked"}
        closable={!busy}
        mask={{ closable: false }}
        okText="退出且不保存"
        cancelText="继续编辑"
        okButtonProps={{ danger: true, disabled: busy !== null }}
        cancelButtonProps={{ disabled: busy !== null }}
        onOk={() => {
          if (blocker.state === "blocked" && !busy) blocker.proceed();
        }}
        onCancel={() => {
          if (blocker.state === "blocked" && !busy) blocker.reset();
        }}
      >
        <p>
          {busy
            ? "请等待本次请求结束后再离开页面。"
            : "退出将丢弃本次未保存的修改，是否继续？"}
        </p>
      </Modal>
    </>
  );
}

function LoadedCalculation({
  sourceId,
  copy,
  readOnly,
}: {
  sourceId: string;
  copy: boolean;
  readOnly: boolean;
}) {
  const remote = useRemote((signal) => api.detail(sourceId, signal), sourceId);
  const navigate = useNavigate();
  if (remote.loading)
    return (
      <div className="page-loading">
        <Spin description="正在读取计算记录" />
      </div>
    );
  if (!remote.data || remote.error)
    return (
      <>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/calculations")}
        >
          返回列表
        </Button>
        <RequestError
          error={remote.error || "未找到计算记录"}
          retry={remote.reload}
        />
      </>
    );
  return (
    <CalculationEditor
      initial={hydrateEditor(remote.data, copy)}
      id={copy ? null : sourceId}
      copied={copy}
      readOnly={!copy && (readOnly || remote.data.status === 2)}
      detail={remote.data}
    />
  );
}

export function CalculationPage({ readOnly = false }: { readOnly?: boolean }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const copyId = !id ? params.get("copy") : null;
  const sourceId = id || copyId;
  return sourceId ? (
    <LoadedCalculation
      key={`${sourceId}:${!!copyId}`}
      sourceId={sourceId}
      copy={!!copyId}
      readOnly={readOnly}
    />
  ) : (
    <CalculationEditor initial={emptyEditor} />
  );
}
