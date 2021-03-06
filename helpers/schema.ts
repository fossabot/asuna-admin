import _ from 'lodash';
import * as R from 'ramda';

import { castModelKey, castModelName } from './cast';
import { modelProxy } from '../adapters/model';
import { DynamicFormTypes } from '../components/DynamicForm';
import { storeConnector } from '../store';
import { createLogger, lv } from './logger';

const logger = createLogger('helpers:schema', lv.warn);

export const peek = (message, callback?) => fields => {
  if (callback) callback();
  logger.log('[peek]', { message, fields });
  return fields;
};

export const tables = {
  treeDecorator({ schema, items }) {
    const TAG = '[treeDecorator]';
    logger.log(TAG, { schema, items });
    const field = R.compose(R.find((field: Asuna.Schema.FormSchema) => field.options.type === 'Tree'), R.values)(
      schema,
    );
    if (field) {
      logger.log(TAG, { field });
      // TODO need implemented.
    }
    return { schema, items };
  },
};
export const hiddenComponentDecorator = fields => {
  const TAG = '[hiddenComponentDecorator]';
  logger.log(TAG, { fields });

  let wrappedFields = R.omit([castModelKey('createdAt'), castModelKey('updatedAt')])(fields);
  if (R.has('id', wrappedFields)) {
    const hidden = R.isNil(wrappedFields.id.value);
    wrappedFields = R.mergeDeepRight(wrappedFields, { id: { options: { hidden } } });
  }

  const positions = R.filter(R.pathEq(['options', 'type'], 'SortPosition'))(wrappedFields);
  if (!R.isEmpty(positions)) {
    const hiddenPositions = R.map(position => ({
      ...position,
      options: { hidden: true },
    }))(positions);

    wrappedFields = R.mergeDeepRight(wrappedFields, { ...hiddenPositions });
  }
  return wrappedFields;
};

/**
 * 异步加载所有的关联对象，用于下拉菜单提示
 * @param fields
 * @returns {Promise<*>}
 */
export const asyncLoadAssociationsDecorator = async fields => {
  const TAG = '[asyncLoadAssociationsDecorator]';
  logger.log(TAG, { fields });

  const relationShips = [DynamicFormTypes.Association, DynamicFormTypes.ManyToMany];
  const associations = R.filter(field => R.contains(field.type)(relationShips))(fields);

  if (R.not(R.isEmpty(associations))) {
    logger.info(TAG, 'associations is', associations);

    // 当已经拉取过数据后不再进行拉取
    const filteredAssociations = R.pickBy(field => R.not(R.has('associations', field)))(associations);
    logger.log(TAG, { filteredAssociations });
    if (R.isEmpty(filteredAssociations)) {
      return fields;
    }

    const auth = storeConnector.getState('auth');

    const wrappedAssociations = await Promise.all(
      R.values(filteredAssociations).map(async field => {
        const selectable = R.pathOr([], ['options', 'selectable'])(field);
        logger.info(TAG, 'handle field', { field, selectable });
        if (selectable) {
          const fieldsOfAssociations = modelProxy.getFieldsOfAssociations();

          const foreignOpts = [
            {
              modelName: selectable,
              association: fieldsOfAssociations[selectable],
            },
          ];
          logger.info(TAG, 'foreignOpts is', foreignOpts);

          const effects = modelProxy.listAssociationsCallable(auth, [selectable]);
          logger.info(TAG, 'list associations callable', effects);

          let allResponse = {};
          try {
            allResponse = await Promise.all(R.values(effects));
            logger.info(TAG, 'allResponse is', allResponse);
          } catch (e) {
            logger.error(TAG, e);
          }

          const foreignKeysResponse = R.zipObj([selectable], R.map(R.prop('data'), allResponse));
          logger.info(TAG, 'foreignOpts is', foreignOpts, 'foreignKeysResponse is', foreignKeysResponse);

          return { ...field, foreignOpts, associations: foreignKeysResponse };
        }
        logger.warn(TAG, 'no foreignKeys with association', field);
        return { ...field, type: DynamicFormTypes.Input };
      }),
    );

    const pairedWrappedAssociations = R.zipObj(R.keys(filteredAssociations), wrappedAssociations);
    logger.info(TAG, 'wrapped associations', { pairedWrappedAssociations });

    // FIXME 临时解决关联数据从 entities 到 ids 的转换

    const transformedAssociations = R.map(association => {
      let value;
      if (_.isArrayLike(association.value)) {
        value = association.value ? R.map(entity => R.propOr(entity, 'id', entity))(association.value) : undefined;
      } else {
        value = association.value ? R.propOr(association.value, 'id', association.value) : undefined;
      }
      return { ...association, value };
    })(pairedWrappedAssociations);

    logger.info(TAG, 'transformed associations', transformedAssociations);

    return R.mergeDeepRight(fields, transformedAssociations);
  }

  return fields;
};

/**
 * 自动通过公共 associations 填充未定义的关联
 * @param fields
 * @returns {*}
 */
export const associationDecorator = fields => {
  const TAG = '[associationDecorator]';
  logger.log(TAG, { fields });

  const associationFields = R.filter(R.compose(R.not, R.isNil, R.prop('associations')))(fields);
  if (R.not(R.isEmpty(associationFields))) {
    logger.info(TAG, { associationFields });
    const wrapForeignOpt = R.map(opt => ({
      ...opt,
      association: modelProxy.getAssociationConfigs(opt.modelName),
    }));
    const withAssociations = R.mapObjIndexed(field => ({
      ...field,
      foreignOpts: wrapForeignOpt(field.foreignOpts),
    }))(associationFields);
    logger.info(TAG, { withAssociations, wrapForeignOpt });

    const wrappedFields = R.mergeDeepRight(fields, withAssociations);
    logger.info(TAG, { wrappedFields });

    return wrappedFields;
  }

  return fields;
};

export const jsonDecorator = fields => {
  const TAG = '[jsonDecorator]';
  logger.log(TAG, { fields });

  const jsonFields = R.filter(R.pathEq(['options', 'json'], 'str'))(fields);
  if (R.not(R.isEmpty(jsonFields))) {
    logger.info(TAG, { jsonFields });

    const toJson = value => {
      if (R.is(String, value) && value.length) {
        try {
          return JSON.parse(value);
        } catch (e) {
          logger.warn(TAG, e, { jsonFields });
          return null;
        }
      } else if (R.is(Object, value)) {
        return value;
      }
      return null;
    };

    const transformValue = R.over(R.lens(R.prop('value'), R.assoc('value')), toJson);
    const transformedFields = R.map(transformValue)(jsonFields);
    return R.mergeDeepRight(fields, transformedFields);
  }

  return fields;
};

/**
 * 通过 Enum 定义中的 enum_data 的 key 值拉取相应 schema 中的关联
 * 通过所有的被选关联字段的 schema name 和 key 比较
 * 目前认为每个 model schema 只有一个 enum filter 定义
 * @param fields
 * @returns {*}
 */
export const enumDecorator = fields => {
  const TAG = '[enumDecorator]';
  logger.log(TAG, { fields });

  const enumFilterFields = R.filter(R.propEq('type', DynamicFormTypes.EnumFilter))(fields);
  if (R.not(R.isEmpty(enumFilterFields))) {
    const [, enumFilterField] = R.toPairs(enumFilterFields)[0];
    // console.log(enumFilterField);
    logger.info(TAG, { enumFilterField });

    const enums = R.compose(
      R.map(castModelName), // 默认情况下需要调整枚举名称用于找到相应的关联
      R.map(R.prop('key')),
      R.path(['options', 'enumData']),
    )(enumFilterField);
    const current = castModelName(R.pathOr('', ['value'])(enumFilterField));
    logger.info(TAG, { enums, current });

    // check if positions has value already
    // save positions value if no value exists, update models' sequence for else
    const positionsFieldPair = R.compose(
      R.toPairs,
      R.map(field => {
        // raw is the original value, if exists, means it's update request
        if (field.value && !field.raw) {
          const value = R.is(String, field.value) ? JSON.parse(field.value) : field.value;
          return { ...field, value, raw: field.value };
        }
        return { ...field, value: R.path([current, 'value'])(fields), raw: field.value };
      }),
      R.filter(R.pathEq(['options', 'type'], 'SortPosition')),
    )(fields);

    const filteredNames = R.without(current)(enums);
    const filteredFields = R.omit(filteredNames)(fields);
    const wrappedFields = current
      ? R.mergeDeepRight(filteredFields, {
          [current]: {
            isFilterField: true,
            options: { filterType: R.path(['options', 'filterType'])(enumFilterField) },
            value: R.isEmpty(positionsFieldPair)
              ? R.path([current, 'value'])(filteredFields)
              : R.path([0, 1, 'value'])(positionsFieldPair),
          },
          ...R.fromPairs(positionsFieldPair),
        })
      : filteredFields;
    logger.info(TAG, {
      current,
      filteredNames,
      filteredFields,
      wrappedFields,
      positionsFieldPair,
    });

    return wrappedFields;
  }

  return fields;
};
