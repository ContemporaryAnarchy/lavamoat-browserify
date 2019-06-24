// Sesify Prelude
;(function() {

  // define SES
  const SES = (function(){
    const exports = {}
    const module = { exports }
    ;(function(){
// START of injected code from sesDist
__sesDist__
// END of injected code from sesDist
    })()
    return module.exports
  })()

  // define Muta
  const Muta = (function(){
    const exports = {}
    const module = { exports }
    ;(function(){
// START of injected code from muta
__mutaDist__
// END of injected code from muta
    })()
    return module.exports
  })()

  const realm = SES.makeSESRootRealm({
    mathRandomMode: 'allow',
    errorStackMode: 'allow',
  })

  const sesifyConfig = (function(){
// START of injected code from sesifyConfig
__sesifyConfig__
// END of injected code from sesifyConfig
  })()

  return loadBundle


  // this performs an unsafeEval in the context of the provided endowments
  function evalWithEndowments(code, endowments) {
    with (endowments) {
      return eval(code)
    }
  }

  function loadBundle (modules, _, entryPoints) {
    const globalRef = (typeof self !== 'undefined') ? self : global
    // setup our global module cache
    const globalCache = {}
    // create SES-wrapped internalRequire
    const createInternalRequire = realm.evaluate(`(${internalRequireWrapper})`, { console })
    const safeInternalRequire = createInternalRequire(modules, globalCache, sesifyConfig, realm, eval, evalWithEndowments, globalRef, Muta)
    // load entryPoints
    for (let entryId of entryPoints) {
      safeInternalRequire(entryId, null, [])
    }
  }

  // this is serialized and run in SES
  // mostly just exists to expose variables to internalRequire
  function internalRequireWrapper (modules, globalCache, sesifyConfig, realm, unsafeEval, unsafeEvalWithEndowments, globalRef, Muta) {
    return internalRequire

    function internalRequire (moduleId, providedEndowments, depPath) {
      const moduleData = modules[moduleId]

      // if we dont have it, throw an error
      if (!moduleData) {
        const err = new Error('Cannot find module \'' + moduleId + '\'')
        err.code = 'MODULE_NOT_FOUND'
        throw err
      }

      // parse requirePath for module boundries
      const moduleDepPath = toModuleDepPath(depPath)
      const packageName = getPackageName(moduleDepPath)
      const moduleCacheSlug = moduleId


      // check our local cache, return exports if hit
      let localCache = globalCache[moduleCacheSlug]
      if (!localCache) {
        localCache = {}
        globalCache[moduleCacheSlug] = localCache
      }
      if (localCache[moduleId]) {
        const module = localCache[moduleId]
        return module.exports
      }

      // prepare the module to be initialized
      const module = { exports: {} }
      localCache[moduleId] = module
      const moduleSource = moduleData[0]
      const configForModule = getConfigForPackage(sesifyConfig, packageName)
      const isEntryModule = moduleDepPath.length < 1

      // prepare endowments
      const endowmentsFromConfig = generateEndowmentsForConfig(configForModule)
      let endowments = Object.assign({}, sesifyConfig.defaultGlobals, providedEndowments, endowmentsFromConfig)
      // special circular reference for endowments to fix globalRef in SES
      // see https://github.com/Agoric/SES/issues/123
      endowments._endowments = endowments
      // special case for exposing window
      if (endowments.window) {
        endowments = Object.assign({}, endowments.window, endowments)
      }

      const environment = configForModule.environment || isEntryModule ? null : 'frozen'
      const runInSes = environment === 'frozen'

      // determine if its a SES-wrapped or naked module initialization
      let moduleInitializer
      if (runInSes) {
        // set the module initializer as the SES-wrapped version
        moduleInitializer = realm.evaluate(`${moduleSource}`, endowments)
      } else {
        // set the module initializer as the unwrapped version
        moduleInitializer = unsafeEvalWithEndowments(`${moduleSource}`, endowments)
      }
      if (typeof moduleInitializer !== 'function') {
        throw new Error('Sesify - moduleInitializer is not defined correctly')
      }

      // this "modules" interface is exposed to the moduleInitializer https://github.com/browserify/browser-pack/blob/master/prelude.js#L38
      // browserify's browser-resolve uses arguments[4] to do direct module initializations
      // this proxy shims this behavior
      // TODO: would be better to just fix this by removing the indirection
      const modulesProxy = new Proxy({}, {
        get (_, targetModuleId) {
          const fakeModuleDefinition = [fakeModuleInitializer]
          return fakeModuleDefinition

          function fakeModuleInitializer () {
            const targetModuleExports = internalRequire(targetModuleId, providedEndowments, depPath)
            // const targetModuleExports = scopedRequire(targetModuleId)
            module.exports = targetModuleExports
          }
        }
      })

      // initialize the module with the correct context
      try {
        moduleInitializer.call(module.exports, scopedRequire, module, module.exports, null, modulesProxy)
      } catch (err) {
        console.warn(`Sesify - Error instantiating module "${moduleId}" from package "${packageName}"`)
        throw err
      }

      // prevent module.exports from being modified
      // const containment = configForModule.containment || 'freeze'
      // if (containment === 'freeze') {
      //   Object.freeze(module.exports)
      // }

      // return the exports
      return module.exports


      // this is the require method passed to the module initializer
      // it has a context of the current dependency path and nested config
      function scopedRequire (requestedName, providedEndowments) {
        const moduleDeps = moduleData[1]
        const id = moduleDeps[requestedName] || requestedName
        // recursive requires dont hit cache so it inf loops, so we shortcircuit
        // this only seems to happen with the "timers" which uses and is used by "process"
        if (id === moduleId) {
          if (['timers', 'buffer'].includes(requestedName) === false) {
            throw new Error(`Sesify - recursive require detected: "${requestedName}"`)
          }
          return module.exports
        }
        // update the dependency path for the child require
        const childDepPath = depPath.slice()
        childDepPath.push(requestedName)
        const moduleExports = internalRequire(id, providedEndowments, childDepPath)
        const copy = Muta(moduleExports)
        // console.log('copy', copy)
        return copy
        // // create a mutable copy
        // switch (typeof moduleExports) {
        //   case 'object':
        //     return magicCopy({}, moduleExports)
        //   case 'function':
        //     // supports both normal functions and both styles of classes
        //     const copy = function (...args) {
        //       if (new.target) {
        //         return Reflect.construct(moduleExports, args, new.target)
        //       } else {
        //         return Reflect.apply(moduleExports, this, args)
        //       }
        //     }
        //     magicCopy(copy, moduleExports)
        //     return copy
        //   default:
        //     // safe as is
        //     return moduleExports
        // }
      }
    }

    function magicCopy (target, source) {
      try {
        const props = Object.getOwnPropertyDescriptors(source)
        Object.defineProperties(target, props)
        Reflect.setPrototypeOf(target, Reflect.getPrototypeOf(source))
      } catch (err) {
        console.warn('Sesify - Error performing magic copy:', err.message)
        throw err
      }
      return target
    }

    function toModuleDepPath (depPath) {
      const moduleDepPath = []
      depPath.forEach((requestedName) => {
        const nameParts = requestedName.split('/')
        let nameInitial = nameParts[0]
        // skip relative resolution
        if (['.','..'].includes(nameInitial)) return
        // fix for scoped module names
        const packageName = nameInitial.includes('@') ? `${nameParts[0]}/${nameParts[1]}` : nameInitial
        // record module name
        moduleDepPath.push(packageName)
      })
      return moduleDepPath
    }

    function getConfigForPackage (config, packageName) {
      const packageConfig = (config.resources || {})[packageName] || {}
      return packageConfig
    }

    function getPackageName (path) {
      const packageName = path.slice(-1)[0] || '<entry>'
      return packageName
    }

    function generateEndowmentsForConfig (config) {
      if (!config.globals) return {}
      const globals = {}
      Object.entries(config.globals).forEach(([globalPath, configValue]) => {
        if (configValue !== true) {
          throw new Error('Sesify - unknown value for config globals')
        }
        const value = deepGetAndBind(globalRef, globalPath)
        if (value === undefined) return
        deepSet(globals, globalPath, value)
      })
      return globals
    }

    function deepGetAndBind(obj, pathName) {
      const pathParts = pathName.split('.')
      const parentPath = pathParts.slice(0,-1).join('.')
      const childKey = pathParts[pathParts.length-1]
      const parent = parentPath ? deepGet(globalRef, parentPath) : globalRef
      if (!parent) return parent
      const value = parent[childKey]
      if (typeof value === 'function') {
        return value.bind(parent)
      }
      return value
    }

    function deepGet (obj, pathName) {
      let result = obj
      pathName.split('.').forEach(pathPart => {
        if (result === null) {
          result = undefined
          return
        }
        if (result === undefined) {
          return
        }
        result = result[pathPart]
      })
      return result
    }

    function deepSet (obj, pathName, value) {
      let parent = obj
      const pathParts = pathName.split('.')
      const lastPathPart = pathParts[pathParts.length-1]
      pathParts.slice(0,-1).forEach(pathPart => {
        const prevParent = parent
        parent = parent[pathPart]
        if (parent === null) {
          throw new Error('DeepSet - unable to set "'+pathName+'" on null')
        }
        if (parent === undefined) {
          parent = {}
          prevParent[pathPart] = parent
        }
      })
      parent[lastPathPart] = value
    }

    //# sourceURL=internalRequire
  }

})()
