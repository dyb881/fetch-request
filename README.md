# fetch-request

配置型请求封装，所有参数最终均合成配置对象，并使用 fetch 发出请求

## DEMO

```
import FetchReques, { log } from '@dyb881/fetch-request';

/**
 * 成功状态码
 */
const successCode = [0, 200, '0000', 1000, 1001, 1002, 1003, 1004, 1005];

/**
 * 请求模块初始化并输出请求方法以及参数
 */
export const { baseURL, get, post, put, patch, del, upload } = new FetchReques({
  host: 'http://192.168.0.74:8002', // 服务器地址
  apiPath: '/api', // API地址基础目录
  interceptorsRequest: config => {
    log.request(config);
    return config;
  },
  interceptorsResponse: (res, config) => {
    if (!res.errorText && config.responseType === 'json' && successCode.indexOf(res.code) === -1) {
      res.error = res.code;
      res.errorText = res.msg || '请求异常';
    }
    res.ok = !res.errorText; // 请求结果状态 成功/失败
    log.response(res, config, res.ok);
    return res;
  },
});

```

## 使用方法

例：

```
/**
 * new FetchRequest(config?: IFetchRequestConfig) 用于生成请求方法，余下为默认配置下生成导出的请求方法
 * 注！ 除了 del 对应 DELETE，其他请求方法均对应大写的 method
 */
import FetchRequest, { get, post, put, patch, del, upload } from '@dyb881/fetch-request';

/**
 * 请求方法(url: 请求地址, data?: 请求数据, config?: 请求配置(IConfig) | 请求标签(string)) => Promise<any>
 */
// 直接使用地址请求
get('http://localhost/api/test?id=1000');

// 请求数据 data 会自动叠加到请求地址 url，
get('http://localhost/api/test',{ id: 1000 });

// 请求标签会自动转化至请求配置
get('http://localhost/api/test',{ id: 1000 }, '测试请求');

// 由于所有参数均会合并到配置对象，请求配置甚至可以覆盖 请求地址 url 和 请求数据 data
get('http://localhost/api/test',{ id: 1000 }, {
  label: '测试请求',
  timeout: 5000,
  url: 'http://localhost/api/test/new',
  data: {
    id: 2000
  }
});

// 无限追加覆盖配置
get('http://localhost/api/test',{ id: 1000 }, '测试请求', {
  label: '新测试请求1',
});
get('http://localhost/api/test',{ id: 1000 }, '测试请求', {
  label: '新测试请求1',
}, {
  label: '新测试请求2',
});

// 除了 get 和 upload 以外的请求方法中的 请求数据 data 会根据 headers['Content-type'] 的类型处理提交数据
// 如 application/json 会自动 JSON.stringify 处理请求数据
post('http://localhost/api/test',{ id: 1000 });

// upload 会把请求数据写入 FormData 对象，放入 body，并清空 headers，用于上传文件
// 后端可直接使用 file 字段获取文件
upload('http://localhost/api/upload', { file: File }, '上传文件');

/**
 * 生成请求方法
 * 基础路径 baseURL = host + apiPath
 * 配置覆盖等级 默认配置 < 初始化请求配置 < 请求方法配置
 */
const { baseURL, get, post, put, patch, del, upload } = new FetchRequest({
  host: 'http://localhost',
  apiPath: '/api',
  // 请求配置
  defaultConfig: {
    timeout: 3000,
  },
  // 请求拦截
  interceptorsRequest: (config: IConfig) => {
    // 拦截处理请求配置
    return config;
  }
  // 响应拦截
  interceptorsResponse: (res: any, config: IConfig) => {
    // 拦截处理响应数据
    return res;
  }
});

// 可省略基础路径，地址自动与 baseURL 拼接
get('/test');
```

## 返回值

请求结束后会返回 请求信息 和 请求结果 的合并对象，请求结果优先于请求信息

```
{
  // 请求信息
  time: {
    start: '12:21:38', // 开始请求时间
    end: '12:21:39', // 结束请求时间
    total: '1秒', // 请求时长
  },
  error: 错误信息,
  errorText: 错误文本解析,
  // 请求结果
  ...res,
}
```

## 控制台打印日志

```
import FetchRequest, { log } from '@dyb881/fetch-request';

const { get } = new FetchRequest({
  // 请求拦截
  interceptorsRequest: (config: IConfig) => {
    // 打印日志
    log.request(config);

    // 拦截处理请求配置
    return config;
  }
  // 响应拦截
  interceptorsResponse: (res: any, config: IConfig) => {
    res.ok = !res.errorText; // 请求结果状态 成功/失败

    // 打印日志
    log.response(res, config, res.ok);

    // 拦截处理响应数据
    return res;
  }
});
```

## 请求配置

所有请求方法的参数都会合并到请求配置对象

```
interface IConfig {
  mode?: 'same-origin' | 'no-cors' | 'cors' | 'navigate'; // 请求的模式
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; // 请求类型，部分后端只能识别大写
  cache?: 'default' | 'no-store' | 'reload' | 'no-cache' | 'force-cache' | 'only-if-cached'; // 缓存模式
  credentials?: 'omit' | 'same-origin' | 'include'; // 是否应该在来源请求中发送来自其他域的cookie
  responseType?: 'json' | 'text' | 'blob'; // 响应数据类型
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

// 数据类型
export const application = {
  json: 'application/json', // json格式
  form: 'application/x-www-form-urlencoded', // 表单对象格式
};

// 默认配置
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

```

## 初始化配置

new FetchRequest 时所需参数

```
interface IFetchRequestConfig {
  host?: string; // API地址
  apiPath?: string; // API目录
  defaultConfig?: IConfig; // 默认配置
  interceptorsRequest?: (config: IConfig) => IConfig; // 请求拦截，可以返回拦截处理的配置
  interceptorsResponse?: (res: any, config: IConfig) => any; // 响应拦截，可以返回拦截处理的结果
}
```
