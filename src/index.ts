import qs from 'qs';

/**
 * 默认请求配置
 */
export type TConfig = {
  mode?: 'same-origin' | 'no-cors' | 'cors' | 'navigate'; // 请求的模式
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; // 请求类型，部分后端只能识别大写
  cache?: 'default' | 'no-store' | 'reload' | 'no-cache' | 'force-cache' | 'only-if-cached'; // 缓存模式
  credentials?: 'omit' | 'same-origin' | 'include'; // 是否应该在来源请求中发送来自其他域的cookie
  responseType?: 'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text'; // 响应数据类型
  // 请求头
  headers?: {
    Accept?: string; // 期望得到数据格式
    'Content-Type'?: string; // 传递参数格式
    [key: string]: any;
  };
  timeout?: number; // 请求超时
  body?: any; // 请求主体
  url?: string; // 请求地址
  data?: any; // 请求元数据，转为主体前的数据
  label?: string; // 请求标签，一般用于请求日志标记
  [key: string]: any;
};

/**
 * 初始化配置
 */
export type TFetchRequestConfig = {
  defaultConfig?: TConfig; // 默认配置
  host?: string; // API地址
  apiPath?: string; // API目录
  interceptorsRequest?: (config: TConfig) => TConfig; // 请求拦截，可以返回拦截处理的配置
  interceptorsResponse?: (res: any, config: TConfig) => any; // 响应拦截，可以返回拦截处理的结果
  requestFunction?: (config: TConfig) => Promise<any>; // 重写请求方法
};

/**
 * 数据类型
 */
export const application = {
  json: 'application/json', // json格式
  form: 'application/x-www-form-urlencoded', // 表单对象格式
};

/**
 * 对象数据写入表单对象
 * 主要用于上传文件
 */
const getFormData = (data: object | FormData, key = '', body = new FormData()) => {
  if (data instanceof FormData) return data;
  for (const [i, item] of Object.entries(data)) {
    const k = key ? `${key}[${i}]` : i;
    if (typeof item === 'object' && !(item instanceof File)) {
      // 把对象拆分写入
      getFormData(item, k, body);
    } else {
      // 写入值
      body.append(k, item);
    }
  }
  return body;
};

/**
 * 根据数据类型生成方法
 */
const applicationToBodyFun = {
  [application.json]: JSON.stringify,
  [application.form]: qs.stringify,
};

/**
 * data 转为请求主体
 */
const toBody = (config: TConfig) => {
  if (config.method === 'GET') {
    // 把参数转化后拼接到 url
    const params = qs.stringify(config.data);
    if (params) config.url += `?${params}`;
  } else {
    // 根据请求类型处理转化 data 为 body
    const contentType = ['Content-Type', 'Content-type', 'content-Type', 'content-type'].reduce((c, i) => {
      return (config.headers && config.headers[i]) || c;
    }, '');
    const toBodyFun = contentType ? applicationToBodyFun[contentType] : getFormData;
    config.body = toBodyFun(config.data);
  }
  return config;
};

/**
 * 如果配置为文本类型，直接写入 label
 */
const labelToConfig = (config?: TConfig | string) => {
  return typeof config === 'string' ? { label: config } : config;
};

/**
 * 统计时间
 */
const statisticalTime = () => {
  const start = new Date();
  return () => {
    const end = new Date();
    return { start: start.toTimeString(), end: end.toTimeString(), total: `${(+end - +start) / 1000}秒` };
  };
};

/**
 * 错误解析字段
 */
const erroText = {
  timeout: '网络连接超时',
  'Network Error': '请求地址错误',
  'Failed to fetch': '请求地址错误',
  'request:fail': '请求地址错误',
};

/**
 * 异常分析 错误信息 => 错误解析文本
 */
const erroToText = (error: string): string => {
  for (const [key, item] of Object.entries(erroText)) {
    // 正则匹配得到错误文本
    if (new RegExp(key).test(error)) return item;
  }
  return '其他错误';
};

/**
 * 控制台打印颜色
 */
const consoleStyle = {
  request: 'color: #0089E5;',
  success: 'color: #2DB700;',
  fail: 'color: #F41900;',
};

/**
 * 打印日志
 * 请求配置的 请求标签 label 代表打印日志的 文本内容
 */
export const log = {
  request: (config: TConfig) => {
    console.groupCollapsed(`%cRequest: ${config.label || config.url} ⇅`, consoleStyle.request);
    console.log('请求类型：', config.method);
    console.log('请求地址：', config.url);
    console.log('请求数据：', config.data || '无');
    console.log('请求配置：', config);
    console.groupEnd();
  },
  response: (res: any, config: TConfig, success: boolean) => {
    let title = `%cResponse: ${config.label || config.url} ${success ? '√' : '×'}`;
    if (res.time && res.time.total) title += ` 用时：${res.time.total}`;
    console.groupCollapsed(title, consoleStyle[success ? 'success' : 'fail']);
    console.log('响应数据：', res);
    if (!success) {
      console.log('响应异常：', res.error || '无');
      console.log('异常解析：', res.errorText);
    }
    console.groupEnd();
  },
};

/**
 * 请求模型
 */
export default class FetchRequest {
  host = '';
  apiPath = '';

  /**
   * 默认请求配置
   */
  defaultConfig: TConfig = {
    mode: 'cors',
    method: 'GET',
    cache: 'default',
    credentials: 'omit',
    responseType: 'json',
    headers: {
      Accept: application.json,
      'Content-Type': application.json,
    },
    timeout: 5000,
  };

  /**
   * 请求拦截
   */
  interceptorsRequest = (config: TConfig) => config;

  /**
   * 响应拦截
   */
  interceptorsResponse = (res: any, _config: TConfig) => res;

  /**
   * 请求方法
   */
  requestFunction = (config: TConfig) => {
    // 转为主体
    config = toBody(config);

    // 请求控制器
    const controller = new AbortController();
    config.signal = controller.signal;

    // 请求超时
    const timeout = new Promise((_, reject) =>
      setTimeout(() => {
        controller.abort(); // 终止请求
        reject('request timeout');
      }, config.timeout)
    );

    return Promise.race([fetch(config.url!, config), timeout]).then((response) => {
      if (!(response instanceof Response)) return;
      const { responseType } = config;
      // 响应类型为空时使用 json 解析
      return responseType && responseType !== 'json' ? { [responseType]: response[responseType]() } : response.json();
    });
  };

  constructor(config?: TFetchRequestConfig) {
    if (config) {
      const { defaultConfig, requestFunction, ...configs } = config;
      Object.assign(this.defaultConfig, defaultConfig);
      if (requestFunction) this.requestFunction = requestFunction;
      Object.assign(this, configs);
    }
  }

  /**
   * 基础路径
   */
  get baseURL() {
    return this.host + this.apiPath;
  }

  /**
   * 执行请求
   */
  request = (configs: TConfig) => {
    let { url = '', ...config } = configs;

    // 拼接地址
    if (!/^http/.test(url)) url = this.baseURL + url;

    // 请求拦截
    config = this.interceptorsRequest({ url, ...this.defaultConfig, ...config });

    // 开始统计时间
    const st = statisticalTime();

    // 处理结果
    return this.requestFunction(config) // 转化响应数据
      .catch((error) => ({ error, errorText: erroToText(error) })) // 异常分析
      .then((res) => this.interceptorsResponse({ time: st(), ...res }, config)); // 载入响应拦截
  };

  /**
   * 创建请求器
   */
  createRequest = (method: TConfig['method'], configs?: TConfig) => {
    return (url: string, data?: object, ...args: (TConfig | string)[]) => {
      return this.request(Object.assign({ method, url, data }, configs, ...args.map((i) => labelToConfig(i))));
    };
  };

  get = this.createRequest('GET');
  post = this.createRequest('POST');
  put = this.createRequest('PUT');
  patch = this.createRequest('PATCH');
  del = this.createRequest('DELETE');
  upload = this.createRequest('POST', { headers: {} });
}
