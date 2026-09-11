import { K8sModel } from '@openshift-console/dynamic-plugin-sdk';
import { ScopeConfigDef } from '../model/scope';

export const defaultHost = '/api/proxy/plugin/netobserv-plugin/backend';
export class ContextSingleton {
  private static instance: ContextSingleton;
  private isStandalone: boolean;
  private isMock: boolean;
  private host: string;
  private forcedNamespace?: string;
  private flowCollectorK8SModel?: K8sModel;
  private scopes: ScopeConfigDef[] = [];

  private constructor() {
    this.host = defaultHost;
    this.isStandalone = false;
    this.isMock = false;
  }

  public static getInstance(): ContextSingleton {
    if (!ContextSingleton.instance) {
      ContextSingleton.instance = new ContextSingleton();
    }

    return ContextSingleton.instance;
  }

  public static setStandalone() {
    const instance = ContextSingleton.getInstance();
    instance.isStandalone = true;
    instance.host = '';
  }

  public static setMock() {
    const instance = ContextSingleton.getInstance();
    instance.isMock = true;
  }

  public static setContext(forcedNamespace?: string) {
    const instance = ContextSingleton.getInstance();
    if (!instance.isStandalone) {
      instance.host = defaultHost;
    }
    instance.forcedNamespace = forcedNamespace;
  }

  public static setFlowCollectorK8SModel(model?: K8sModel) {
    const instance = ContextSingleton.getInstance();
    instance.flowCollectorK8SModel = model;
  }

  public static isStandalone() {
    return ContextSingleton.getInstance().isStandalone;
  }

  public static isMock() {
    return ContextSingleton.getInstance().isMock;
  }

  public static getHost() {
    return ContextSingleton.getInstance().host;
  }

  public static getForcedNamespace() {
    return ContextSingleton.getInstance().forcedNamespace;
  }

  public static getFlowCollectorK8SModel() {
    return ContextSingleton.getInstance().flowCollectorK8SModel;
  }

  public static setScopes(scps: ScopeConfigDef[]) {
    ContextSingleton.getInstance().scopes = scps;
  }

  public static getScopes() {
    return ContextSingleton.getInstance().scopes;
  }
}
