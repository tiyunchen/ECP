import { useState } from "react";
import {
  App,
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { TableColumnsType } from "antd";
import type { Dayjs } from "dayjs";
import { Link, useNavigate } from "react-router-dom";
import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { api, errorMessage } from "../../api/client";
import type { ProjectQuery, ProjectSummary } from "../../api/types";
import { useRemote } from "../../hooks/useRemote";
import { RequestError } from "../../components/RequestError";

interface FilterValues {
  keyword?: string;
  status?: 1 | 2;
  period?: [Dayjs, Dayjs];
}

export function ProjectList() {
  const [form] = Form.useForm<FilterValues>();
  const [query, setQuery] = useState<ProjectQuery>({ page: 1, page_size: 10 });
  const [deleting, setDeleting] = useState<string | null>(null);
  const remote = useRemote(
    (signal) => api.projects(query, signal),
    JSON.stringify(query),
  );
  const navigate = useNavigate();
  const { message } = App.useApp();

  async function remove(id: string) {
    if (deleting) return;
    setDeleting(id);
    try {
      await api.remove(id);
      message.success("计算记录已删除");
      // 删除末页最后一条后回退一页，保持列表分页与剩余记录一致。
      if (remote.data?.list.length === 1 && query.page > 1)
        setQuery({ ...query, page: query.page - 1 });
      else remote.reload();
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setDeleting(null);
    }
  }

  const columns: TableColumnsType<ProjectSummary> = [
    {
      title: "项目名称",
      dataIndex: "project_name",
      width: 260,
      ellipsis: true,
      render: (name: string, row) => (
        <Tooltip title={name || "未命名计算"}>
          <Link
            to={`/calculations/${row.id}${row.status === 1 ? "/edit" : ""}`}
          >
            {name || "未命名计算"}
          </Link>
        </Tooltip>
      ),
    },
    {
      title: "污染物指标",
      dataIndex: "pollutant_names",
      width: 220,
      ellipsis: true,
      render: (value) => value || "—",
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (status) => (
        <Tag color={status === 2 ? "success" : "warning"}>
          {status === 2 ? "已完成" : "暂存"}
        </Tag>
      ),
    },
    {
      title: "计算进度",
      width: 150,
      render: (_, row) => (
        <>
          <span>{row.completed_count ?? 0} 项完成</span>
          <div className="muted small">{row.pending_count ?? 0} 项待补充</div>
        </>
      ),
    },
    {
      title: "创建人",
      dataIndex: "create_by",
      width: 100,
      render: (value) => value || "—",
    },
    { title: "更新时间", dataIndex: "gmt_modified", width: 170 },
    {
      title: "操作",
      key: "actions",
      width: 220,
      fixed: "right",
      render: (_, row) => (
        <Space size={12}>
          <Link
            to={`/calculations/${row.id}${row.status === 1 ? "/edit" : ""}`}
          >
            {row.status === 1 ? "继续编辑" : "查看结果"}
          </Link>
          <Link to={`/calculations/new?copy=${encodeURIComponent(row.id)}`}>
            复制新建
          </Link>
          <Popconfirm
            title="删除这条计算记录？"
            description="删除后将无法从列表中查看。"
            okText="删除"
            okButtonProps={{ danger: true, loading: deleting === row.id }}
            onConfirm={() => remove(row.id)}
          >
            <Button
              type="link"
              danger
              size="small"
              disabled={deleting !== null}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <header className="page-heading">
        <div>
          <div className="breadcrumb-text">源强计算工具</div>
          <h1>二污普系数计算</h1>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => navigate("/calculations/new")}
        >
          新建计算
        </Button>
      </header>
      <section className="section-card list-card">
        <Form
          form={form}
          layout="vertical"
          className="project-filters"
          onFinish={({ keyword, status, period }) =>
            setQuery({
              keyword: keyword?.trim(),
              status,
              modified_from: period?.[0].format("YYYY-MM-DD"),
              modified_to: period?.[1].format("YYYY-MM-DD"),
              page: 1,
              page_size: query.page_size,
            })
          }
        >
          <Form.Item name="keyword" label="项目名称 / 污染物">
            <Input
              allowClear
              placeholder="请输入关键词"
              prefix={<SearchOutlined />}
            />
          </Form.Item>
          <Form.Item name="status" label="记录状态">
            <Select
              allowClear
              placeholder="全部状态"
              options={[
                { value: 1, label: "暂存" },
                { value: 2, label: "已完成" },
              ]}
            />
          </Form.Item>
          <Form.Item name="period" label="更新时间">
            <DatePicker.RangePicker />
          </Form.Item>
          <Space className="filter-actions">
            <Button type="primary" htmlType="submit">
              查询
            </Button>
            <Button
              onClick={() => {
                form.resetFields();
                setQuery({ page: 1, page_size: 10 });
                remote.reload();
              }}
            >
              重置
            </Button>
          </Space>
        </Form>
        <div className="list-heading">
          <h2>计算记录</h2>
          <Button
            icon={<ReloadOutlined />}
            onClick={remote.reload}
            loading={remote.loading}
          >
            刷新
          </Button>
        </div>
        <RequestError error={remote.error} retry={remote.reload} />
        <Table<ProjectSummary>
          rowKey="id"
          columns={columns}
          dataSource={remote.data?.list || []}
          loading={remote.loading}
          scroll={{ x: 1280 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  remote.error
                    ? "暂时无法获取计算记录"
                    : "暂无计算记录，点击「新建计算」开始"
                }
              />
            ),
          }}
          pagination={{
            current: query.page,
            pageSize: query.page_size,
            total: remote.data?.total || 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, page_size) =>
              setQuery({
                ...query,
                page: page_size === query.page_size ? page : 1,
                page_size,
              }),
          }}
        />
      </section>
    </>
  );
}
