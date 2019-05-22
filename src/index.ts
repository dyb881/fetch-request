import qs from 'qs';

/**
 * 默认请求配置
 */
interface IConfig {
  mode?: 'same-origin' | 'no-cors' | 'cors' | 'navigate'; // 请求的模式
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; // 请求类型，部分后端只能识别大写
  cache?: 'default' | 'no-store' | 'reload' | 'no-cache' | 'force-cache' | 'only-if-cached'; // 缓存模式
  credentials?: 'omit' | 'same-origin' | 'include'; // 是否应该在来源请求中发送来自其他域的cookie
  // 请求头
  headers?: {
    Accept?: string; // 期望得到数据格式
    'Content-type'?: string; // 传递参数格式
    [key: string]: any;
  };
  timeout?: number; // 请求超时
  body?: any; // 请求主体
  url?: string; // 请求地址
  data?: any; // 请求元数据，转为主体前的数据
  label?: string; // 请求标签，一般用于请求日志标记
  [key: string]: any;
}

/**
 * 初始化配置
 */
interface IFetchRequestConfig {
  defaultConfig?: IConfig; // 默认配置
  host?: string; // API地址
  apiPath?: string; // API目录
  interceptorsRequest?: (config: IConfig) => IConfig; // 请求拦截，可以返回拦截处理的配置
  interceptorsResponse?: (res: any, config: IConfig) => any; // 响应拦截，可以返回拦截处理的结果
}

/**
 * 数据类型
 */
export const application = {
  json: 'application/json', // json格式
  form: 'application/x-www-form-urlencoded', // 表单对象格式
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
const toBody = (config: IConfig) => {
  if (config.method === 'GET') {
    const body = qs.stringify(config.data);
    if (body) config.url += `?${body}`;
  } else {
    const contentType = (config.headers && config.headers['Content-type']) || application.json;
    const body = applicationToBodyFun[contentType] && applicationToBodyFun[contentType](config.data);
    if (body && ['{}', '[]'].indexOf(body) === -1) config.body = body;
  }
  return config;
};

/**
 * 如果配置为文本类型，直接写入 label
 */
const labelToConfig = (config?: IConfig | string) => (typeof config === 'string' ? { label: config } : config);

/**
 * 对象数据写入表单对象
 * 主要用于上传文件
 */
const getFormData = (data: object) => {
  const body = new FormData();
  const setData = (data: object, key = '') => {
    Object.keys(data).forEach(i => {
      const item = data[i];
      if (item && typeof item === 'object' && !(item instanceof File)) {
        setData(item, key ? `${key}[${i}]` : i);
      } else {
        body.append(key ? `${key}[${i}]` : i, item);
      }
    });
  };
  setData(data);
  return body;
};

/**
 * 统计时间
 */
const statisticalTime = () => {
  const start = new Date();
  return () => {
    const end = new Date();
    return {
      start: start.toTimeString(),
      end: end.toTimeString(),
      total: `${(+end - +start) / 1000}秒`,
    };
  };
};

/**
 * 错误解析字段
 */
const erroText = {
  timeout: '网络连接超时',
  'Network Error': '请求地址错误或跨域未允许',
  'Failed to fetch': '请求地址错误或跨域未允许',
};

/**
 * 异常分析 错误信息 => 错误解析文本
 */
const erroToText = (error: string): string => {
  for (const reg in erroText) {
    if (new RegExp(reg).test(error)) {
      return erroText[reg];
    }
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
  request: (config: IConfig) => {
    console.groupCollapsed(`%cRequest: ${config.label || config.url} ⇅`, consoleStyle.request);
    console.log('请求类型：', config.method);
    console.log('请求地址：', config.url);
    console.log('请求数据：', config.data || '无');
    console.log('请求配置：', config);
    console.groupEnd();
  },
  response: (res: any, config: IConfig, success: boolean) => {
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
  defaultConfig: IConfig = {
    mode: 'cors',
    method: 'GET',
    cache: 'default',
    credentials: 'omit',
    headers: {
      Accept: application.json,
      'Content-type': application.json,
    },
    timeout: 3000,
  };
  interceptorsRequest = (config: IConfig) => config;
  interceptorsResponse = (res: any, _config: IConfig) => res;

  constructor(config?: IFetchRequestConfig) {
    if (config) {
      const { defaultConfig, ...configs } = config;
      Object.assign(this.defaultConfig, defaultConfig);
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
  request = (configs: IConfig) => {
    let { url = '', ...config } = configs;

    // 拼接地址
    if (!/^http/.test(url)) url = this.baseURL + url;

    // 转为主体，执行请求拦截
    config = this.interceptorsRequest(
      toBody({
        url,
        ...this.defaultConfig,
        ...config,
      })
    );

    // 开始统计时间
    const st = statisticalTime();

    // 发出请求
    return Promise.race([
      fetch(config.url, config), // 追加请求超时
      new Promise((_, reject) => setTimeout(() => reject('request timeout'), config.timeout)),
    ])
      .then(response => {
        if (!(response instanceof Response)) return response;
        try {
          return response.json(); // 默认 json 格式读取数据
        } catch (e) {
          return {
            data: response.text(), // 失败则使用 text 格式读取
          };
        }
      }) // 转化响应数据
      .catch(error => ({
        error,
        errorText: erroToText(error),
      }))
      .then(res => this.interceptorsResponse({ time: st(), ...res }, config)); // 载入响应拦截
  };

  createRequest = (method: IConfig['method']) => (
    url: string,
    data?: object,
    config?: IConfig | string,
    ...args: IConfig[]
  ) => this.request(Object.assign({ method, url, data }, labelToConfig(config), ...args));

  get = this.createRequest('GET');
  post = this.createRequest('POST');
  put = this.createRequest('PUT');
  patch = this.createRequest('PATCH');
  del = this.createRequest('DELETE');
  upload = (url: string, data: object, config?: IConfig | string, ...args: IConfig[]) =>
    this.request(
      Object.assign({ method: 'POST', headers: {}, url, data, body: getFormData(data) }, labelToConfig(config), ...args)
    );
}

export const { get, post, put, patch, del, upload } = new FetchRequest();
