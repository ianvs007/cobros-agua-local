/**
 * Cliente API local que reemplaza a @supabase/supabase-js.
 * Implementa la misma interfaz de encadenamiento (.from().select().eq()...)
 * pero ejecuta peticiones HTTP contra el servidor Express local.
 */

const API_BASE = '/api/rest';

class QueryBuilder {
    constructor(table) {
        this._table = table;
        this._method = 'GET';
        this._body = null;
        this._filters = {};
        this._order = null;
        this._limit = null;
        this._single = false;
        this._maybeSingle = false;
        this._columns = '*';
        this._isUpsert = false;
    }

    select(columns) {
        if (this._method === 'GET' || !this._body) {
            this._method = 'GET';
        }
        if (columns) this._columns = columns;
        // If called after insert/update, this is a "returning" request
        // The server always returns data, so this is a no-op for chaining
        return this;
    }

    insert(data) {
        this._method = 'POST';
        this._body = data;
        return this;
    }

    update(data) {
        this._method = 'PATCH';
        this._body = data;
        return this;
    }

    upsert(data) {
        this._method = 'PUT';
        this._body = data;
        this._isUpsert = true;
        return this;
    }

    delete() {
        this._method = 'DELETE';
        return this;
    }

    eq(col, val) {
        this._filters[col] = `eq.${val}`;
        return this;
    }

    neq(col, val) {
        this._filters[col] = `neq.${val}`;
        return this;
    }

    gt(col, val) {
        this._filters[col] = `gt.${val}`;
        return this;
    }

    lt(col, val) {
        this._filters[col] = `lt.${val}`;
        return this;
    }

    in(col, values) {
        this._filters[col] = `in.(${values.join(',')})`;
        return this;
    }

    not(col, op, val) {
        if (op === 'is' && val === null) {
            this._filters[col] = 'not.is.null';
        }
        return this;
    }

    or(filterStr) {
        this._filters['or'] = `(${filterStr})`;
        return this;
    }

    order(col, opts = {}) {
        const dir = opts.ascending === false ? 'desc' : 'asc';
        this._order = `${col}.${dir}`;
        return this;
    }

    limit(n) {
        this._limit = n;
        return this;
    }

    single() {
        this._single = true;
        return this;
    }

    maybeSingle() {
        this._maybeSingle = true;
        return this;
    }

    // Execute the query (called by await)
    then(resolve, reject) {
        this._execute().then(resolve, reject);
    }

    async _execute() {
        try {
            const params = new URLSearchParams();

            if (this._columns !== '*' && this._method === 'GET') {
                params.set('select', this._columns);
            }

            for (const [key, val] of Object.entries(this._filters)) {
                params.set(key, val);
            }

            if (this._order) params.set('order', this._order);
            if (this._limit) params.set('limit', String(this._limit));

            const qs = params.toString();
            const url = `${API_BASE}/${this._table}${qs ? '?' + qs : ''}`;

            const fetchOpts = {
                method: this._method,
                headers: {}
            };

            if (this._body !== null && this._body !== undefined) {
                fetchOpts.headers['Content-Type'] = 'application/json';
                fetchOpts.body = JSON.stringify(this._body);
            }

            const resp = await fetch(url, fetchOpts);

            if (!resp.ok) {
                const errBody = await resp.json().catch(() => ({ message: resp.statusText }));
                return { data: null, error: { message: errBody.message, code: errBody.code || String(resp.status) } };
            }

            let data = await resp.json();

            if (this._single) {
                data = Array.isArray(data) ? (data[0] || null) : data;
                if (!data) {
                    return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
                }
            }

            if (this._maybeSingle) {
                data = Array.isArray(data) ? (data[0] || null) : data;
            }

            return { data, error: null };
        } catch (err) {
            return { data: null, error: { message: err.message, code: 'FETCH_ERROR' } };
        }
    }
}

// Cliente compatible con la interfaz de Supabase
export const supabase = {
    from(table) {
        return new QueryBuilder(table);
    },
    auth: {
        getSession: async () => ({ data: { session: null } })
    }
};
