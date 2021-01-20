import sortMediaQuery from './sortMediaQuery';
import { Style } from '../style/base';
import { wrapit, hash } from '../../utils/tools';

function combineObject(a:{[key:string]:any}, b:{[key:string]:any}) {
    const output = {...a};
    for (let [key_of_b, value_of_b] of Object.entries(b)) {
        if (a.hasOwnProperty(key_of_b)) {
            const value_of_a = a[key_of_b];
            if (value_of_a !== value_of_b) {
                if (value_of_b !== null && value_of_b.constructor !== Object) {
                    output[key_of_b] = [value_of_a, value_of_b];
                } else if (value_of_a !== null && value_of_a.constructor === Object) {
                    output[key_of_b] = combineObject(value_of_a, value_of_b);
                } else {
                    output[key_of_b] = [
                    value_of_a,
                    combineObject(value_of_a, value_of_b)
                    ]
                }
            }
        } else {
            output[key_of_b] = value_of_b;
        }
    }
    return output;
}
  
  
function deepList(list:string[], value?:any):{} {
    const key = list.pop();
    if (!value) value = {};
    if (!key) return value;
    const dict:{[key:string]:{}} = {}
    dict[key] = value;
    return deepList(list, dict); 
}


function handleNest(item:any) {
    let output:any[] = [];
    if (Array.isArray(item)) {
        item.forEach(i=>{
            output = [...output, ...handleNest(i)];
        });
    } else {
        if (item.build) output.push(item.build());
    }
    return output;
}
  
  
function buildMap(obj:{}, minify=false):string {
    let output:any[] = [];
    if (Array.isArray(obj)) {
        obj.forEach(item=>{
            if (item.constructor === Object) {
                output.push(buildMap(item));
            } else if (Array.isArray(item)) {
                output = [...output, ...handleNest(item)];
            } else {
                if (item.build) output.push(item.build(minify));
            }
        })
    } else {
        for (let [key, value] of Object.entries(obj)) {
            const _gstyle = (v:string) => (minify ? key.replace(/\n/g,'') : key + ' ') + wrapit(v, undefined, undefined, undefined, minify);
            if (value instanceof Style) {
                output.push(_gstyle(value.build(minify)));
            } else if (value && typeof value === 'object'){
                output.push(_gstyle(buildMap(value, minify)));
            }
        }
    }
    return output.join(minify?'':'\n'); 
}

function combineSelector(styleList:Style[]) {
    const styleMap:{[key:string]:Style} = {};
    styleList.forEach(v=>{
        const hashValue = hash(v.rule);
        if (styleMap.hasOwnProperty(hashValue)) {
            styleMap[hashValue] = styleMap[hashValue].extend(v, true);
        } else {
            styleMap[hashValue] = v;
        }
    });
    return Object.values(styleMap).map(i=>i.clean());//.sort());
}

function getWeights(a: string) {
    const first = a.charAt(0);
    const second = a.charAt(1);
    const map:{[key:string]:number} = {
        '.': 200,
        '#': 201
    }
    if (first === ':' && second === ':') return '59';
    return first in map ? map[first] : first.charCodeAt(0);
}

function sortSelector(a: Style, b:Style) {
    if (a.selector && b.selector) {
        return getWeights(a.selector) > getWeights(b.selector) ? 1 : -1;
    } 
    return 0;
}


export default function compileStyleSheet(styleList:Style[], minify=false) {
    // The alternative to stylesheet.build(), and will eventually replace stylesheet.build(), currently in the testing phase.
    const head = combineSelector(styleList.filter(i=>!(i.selector && i.atRules))).sort(sortSelector).map(i=>i.build(minify)).join(minify?'':'\n');
    const body = buildMap(
                styleList.filter(i=>i.selector && i.atRules)
                .map(i=>{
                    const list = [...(i.atRules??[]).sort(sortMediaQuery), i.rule];
                    return deepList(list, new Style(undefined, i.property));
                })
                .sort((a: {}, b: {})=>{
                    const akey = Object.keys(a)[0];
                    const bkey = Object.keys(b)[0];
                    return sortMediaQuery(akey, bkey);
                })
                .reduce((previousValue: {}, currentValue: {})=>combineObject(previousValue, currentValue))
                ,minify);
    return minify? (head+body).replace(/;\}/g, '}') : head + '\n' + body;
}